"""Auth: +91 phone OTP (mock SMS) for customers, email/password JWT for staff,
plus Google Sign-In (customer + staff) and password reset via email.

REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
The frontend ALWAYS uses `window.location.origin` for OAuth redirect targets.
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import re
import secrets
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
from ..services.email import send_email, password_reset_html, welcome_html

log = logging.getLogger("vfast.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

PHONE_RE = re.compile(r"^\+91[6-9]\d{9}$")

# Staff email allowlist (shared with admin user creation).
ALLOWED_STAFF_DOMAINS = {"vmart.co.in", "vmartretail.com", "limeroad.com", "vfast.local"}
ALLOWED_STAFF_EMAILS = {"dineshsrivastava07@gmail.com", "pawanprajapati1980@gmail.com"}
STAFF_ROLES = {"super_admin", "admin", "operations", "seller", "delivery_partner"}


def _validate_indian_phone(phone: str) -> str:
    phone = phone.strip().replace(" ", "")
    if not PHONE_RE.match(phone):
        raise HTTPException(status_code=400, detail="Only +91 Indian mobile numbers are allowed")
    return phone


def is_staff_email(email: str) -> bool:
    email = (email or "").lower().strip()
    if email in ALLOWED_STAFF_EMAILS:
        return True
    domain = email.split("@")[-1] if "@" in email else ""
    return domain in ALLOWED_STAFF_DOMAINS


def _user_out(user: dict) -> dict:
    return {
        "id": user["id"],
        "role": user["role"],
        "name": user.get("name"),
        "email": user.get("email"),
        "phone": user.get("phone"),
    }


# ---------------- Customer OTP (phone) ---------------- #
@router.post("/otp/request")
async def otp_request(payload: OTPRequest, request: Request):
    phone = _validate_indian_phone(payload.phone)
    db = request.state.db
    code = f"{random.randint(0, 999999):06d}"
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
    user = await db.users.find_one({"phone": phone}, {"password_hash": 0})
    if not user:
        user = {
            "id": new_id(), "phone": phone, "role": "customer",
            "name": "VFast Customer", "active": True, "created_at": now_iso(),
        }
        await db.users.insert_one(user.copy())
    if user.get("active") is False:
        raise HTTPException(status_code=403, detail="Your account is deactivated. Contact support.")
    user.pop("_id", None)
    token = create_access_token(user["id"], user["role"], extra={"phone": phone})
    await db.otp_codes.delete_one({"phone": phone})
    return {"token": token, "user": _user_out(user)}


# ---------------- Email login (staff/seller/rider) ---------------- #
@router.post("/login")
async def email_login(payload: EmailLogin, request: Request):
    db = request.state.db
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if user.get("active") is False:
        raise HTTPException(status_code=403, detail="Your account is deactivated. Contact your administrator.")
    if user.get("role") == "customer":
        raise HTTPException(status_code=403, detail="Customers must log in with phone OTP.")
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


# ---------------- Google Sign-In ---------------- #
def _google_client_id() -> Optional[str]:
    cid = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
    return cid or None


def _google_client_secret() -> Optional[str]:
    sec = os.environ.get("GOOGLE_CLIENT_SECRET", "").strip()
    return sec or None


def _google_redirect_uri() -> str:
    return os.environ.get(
        "GOOGLE_REDIRECT_URI",
        "https://vfast.co.in/api/auth/google/callback",
    ).strip()


@router.get("/google/config")
async def google_config():
    """Frontend reads this to know whether to show the Google button."""
    return {
        "enabled": bool(_google_client_id()),
        "client_id": _google_client_id(),
        "redirect_uri": _google_redirect_uri(),
    }


def _verify_google_id_token(credential: str) -> dict:
    """Sync verify; wrapped by `asyncio.to_thread`. Returns claims dict."""
    from google.oauth2 import id_token
    from google.auth.transport import requests as g_requests
    cid = _google_client_id()
    if not cid:
        raise HTTPException(503, "Google Sign-In is not configured")
    try:
        claims = id_token.verify_oauth2_token(credential, g_requests.Request(), cid)
    except ValueError as exc:
        raise HTTPException(401, f"Invalid Google credential: {exc}")
    if not claims.get("email_verified"):
        raise HTTPException(401, "Google email is not verified")
    return claims


@router.post("/google/customer")
async def google_customer(payload: dict, request: Request):
    """Sign in a customer via Google ID token. Creates a customer account on
    first login. If email belongs to existing staff, returns staff JWT instead.
    """
    db = request.state.db
    credential = (payload or {}).get("credential")
    if not credential:
        raise HTTPException(400, "credential required")
    claims = await asyncio.to_thread(_verify_google_id_token, credential)
    email = (claims.get("email") or "").lower().strip()
    name = claims.get("name") or email.split("@")[0].title()
    if not email:
        raise HTTPException(400, "Google did not return an email")
    user = await db.users.find_one({"email": email})
    if user:
        if user.get("active") is False:
            raise HTTPException(403, "Your account is deactivated.")
    else:
        user = {
            "id": new_id(), "email": email, "name": name, "role": "customer",
            "active": True, "google_linked": True, "created_at": now_iso(),
        }
        await db.users.insert_one(user.copy())
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_access_token(user["id"], user["role"], extra={"email": email})
    return {"token": token, "user": _user_out(user)}


@router.post("/google/staff")
async def google_staff(payload: dict, request: Request):
    """Sign in staff/seller/rider via Google. Email must already exist as a
    non-customer user AND be in the staff allowlist (domain or exact)."""
    db = request.state.db
    credential = (payload or {}).get("credential")
    if not credential:
        raise HTTPException(400, "credential required")
    claims = await asyncio.to_thread(_verify_google_id_token, credential)
    email = (claims.get("email") or "").lower().strip()
    if not is_staff_email(email):
        raise HTTPException(403, "This Google account is not authorised for staff access.")
    user = await db.users.find_one({"email": email})
    if not user:
        raise HTTPException(403, "No staff account exists for this Google email. Ask a super admin to create it first.")
    if user.get("role") == "customer":
        raise HTTPException(403, "This is a customer account. Use customer login.")
    if user.get("role") not in STAFF_ROLES:
        raise HTTPException(403, "Account role is not allowed for staff login.")
    if user.get("active") is False:
        raise HTTPException(403, "Your account is deactivated.")
    user.pop("_id", None)
    user.pop("password_hash", None)
    token = create_access_token(user["id"], user["role"], extra={"email": email})
    return {"token": token, "user": _user_out(user)}


# ---------------- Password reset (email link) ---------------- #
PASSWORD_RESET_TTL_HOURS = 2


@router.post("/password-reset/request")
async def password_reset_request(payload: dict, request: Request):
    """Always returns ok=true (don't leak existence). Generates a reset token
    and emails a link to {APP_URL}/reset-password?token=..."""
    db = request.state.db
    email = (payload.get("email") or "").lower().strip()
    if not email:
        raise HTTPException(400, "email required")
    user = await db.users.find_one({"email": email})
    if user and user.get("role") != "customer" and user.get("active") is not False:
        token = secrets.token_urlsafe(32)
        expires_at = (datetime.now(timezone.utc) + timedelta(hours=PASSWORD_RESET_TTL_HOURS)).isoformat()
        await db.password_resets.insert_one({
            "id": new_id(), "user_id": user["id"], "email": email,
            "token": token, "expires_at": expires_at, "used": False,
            "created_at": now_iso(),
        })
        base = os.environ.get("APP_URL", "https://vfast.co.in").rstrip("/")
        link = f"{base}/reset-password?token={token}"
        html = password_reset_html(user.get("name") or "there", link)
        await send_email(email, "Reset your VFast password", html, tag="password-reset")
        log.info("Password reset issued for %s (token=%s...)", email, token[:8])
    return {"ok": True, "message": "If an account exists, a reset link has been emailed."}


@router.post("/password-reset/confirm")
async def password_reset_confirm(payload: dict, request: Request):
    db = request.state.db
    token = (payload.get("token") or "").strip()
    new_password = (payload.get("new_password") or "").strip()
    if not token or len(new_password) < 6:
        raise HTTPException(400, "token and a new password (min 6 chars) are required")
    rec = await db.password_resets.find_one({"token": token, "used": False})
    if not rec:
        raise HTTPException(400, "Invalid or already-used reset link")
    if datetime.fromisoformat(rec["expires_at"]) < datetime.now(timezone.utc):
        raise HTTPException(400, "Reset link expired. Request a new one.")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_password(new_password),
                                          "updated_at": now_iso()}})
    await db.password_resets.update_one({"id": rec["id"]},
                                         {"$set": {"used": True, "used_at": now_iso()}})
    return {"ok": True}


# ---------------- Change password (self-service) ---------------- #
@router.post("/change-password")
async def change_password(payload: dict, request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    full = await db.users.find_one({"id": user["id"]})
    current = (payload.get("current_password") or "").strip()
    new_pw = (payload.get("new_password") or "").strip()
    if len(new_pw) < 6:
        raise HTTPException(400, "New password must be at least 6 characters")
    if not full or not verify_password(current, full.get("password_hash", "")):
        raise HTTPException(401, "Current password is incorrect")
    await db.users.update_one({"id": user["id"]},
                              {"$set": {"password_hash": hash_password(new_pw),
                                          "updated_at": now_iso()}})
    return {"ok": True}
