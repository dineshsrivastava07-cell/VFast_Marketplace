"""Auth: +91 phone OTP (mock) for customers + email/password for staff/seller/rider.

For Phase 1 the OTP is generated and stored in the `otp_codes` collection and
also returned in the API response (dev_code) + logged to backend logs. Swapping
to a real SMS gateway later only requires implementing `send_sms` in
`app/services/sms.py`.
"""
from __future__ import annotations

import logging
import os
import random
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import EmailLogin, OTPRequest, OTPVerify, UserOut, new_id, now_iso
from ..security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from ..services.sms import send_otp_sms

log = logging.getLogger("vfast.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

PHONE_RE = re.compile(r"^\+91[6-9]\d{9}$")


def _validate_indian_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "")
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Only +91 Indian mobile numbers are allowed")
    return phone


@router.post("/otp/request")
async def otp_request(payload: OTPRequest, request: Request):
    phone = _validate_indian_phone(payload.phone)
    db = request.state.db
    code = f"{random.randint(0, 999999):06d}"
    # In dev mode we return the code so testers can verify without an SMS gateway.
    sms_mode = os.environ.get("SMS_PROVIDER", "mock")
    expires_at = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    await db.otp_codes.update_one(
        {"phone": phone},
        {"$set": {"phone": phone, "code": code, "expires_at": expires_at, "created_at": now_iso()}},
        upsert=True,
    )
    log.info("OTP generated for %s -> %s (mode=%s)", phone, code, sms_mode)
    await send_otp_sms(phone, code)
    return {
        "ok": True,
        "phone": phone,
        "dev_code": code if sms_mode == "mock" else None,
        "message": "OTP sent. Use dev_code shown here while we're on mock SMS.",
    }


@router.post("/otp/verify")
async def otp_verify(payload: OTPVerify, request: Request):
    phone = _validate_indian_phone(payload.phone)
    db = request.state.db
    record = await db.otp_codes.find_one({"phone": phone})
    if not record:
        raise HTTPException(status_code=400, detail="OTP not requested")
    if datetime.fromisoformat(record["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP expired, request a new one")
    if record["code"] != payload.code.strip():
        raise HTTPException(status_code=400, detail="Invalid OTP")

    # find or create customer
    user = await db.users.find_one({"phone": phone}, {"password_hash": 0})
    if not user:
        user = {
            "id": new_id(),
            "phone": phone,
            "role": "customer",
            "name": "VFast Customer",
            "created_at": now_iso(),
        }
        await db.users.insert_one(user.copy())
    user.pop("_id", None)
    token = create_access_token(user["id"], user["role"], extra={"phone": phone})
    await db.otp_codes.delete_one({"phone": phone})
    return {"token": token, "user": _user_out(user)}


@router.post("/login")
async def email_login(payload: EmailLogin, request: Request):
    db = request.state.db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["role"], extra={"email": email})
    user.pop("_id", None)
    user.pop("password_hash", None)
    return {"token": token, "user": _user_out(user)}


@router.get("/me", response_model=UserOut)
async def me(user: dict = Depends(get_current_user)):
    return _user_out(user)


@router.post("/logout")
async def logout():
    return {"ok": True}


def _user_out(user: dict) -> dict:
    return {
        "id": user["id"],
        "role": user["role"],
        "name": user.get("name"),
        "email": user.get("email"),
        "phone": user.get("phone"),
    }
