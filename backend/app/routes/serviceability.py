"""Serviceability checks (PIN code allowlist)."""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request

router = APIRouter(prefix="/api/serviceability", tags=["serviceability"])

PIN_RE = re.compile(r"^\d{6}$")


@router.get("/check/{pincode}")
async def check_pincode(pincode: str, request: Request):
    if not PIN_RE.match(pincode):
        raise HTTPException(status_code=400, detail="Invalid Indian PIN code")
    db = request.state.db
    record = await db.serviceable_pincodes.find_one({"pincode": pincode}, {"_id": 0})
    if record and record.get("active", True):
        return {"serviceable": True, **record}
    return {"serviceable": False, "pincode": pincode}


@router.post("/notify-me")
async def notify_me(payload: dict, request: Request):
    pincode = (payload.get("pincode") or "").strip()
    contact = (payload.get("contact") or "").strip()
    if not PIN_RE.match(pincode) or not contact:
        raise HTTPException(status_code=400, detail="pincode and contact required")
    db = request.state.db
    await db.pincode_waitlist.insert_one({
        "id": __import__("uuid").uuid4().hex,
        "pincode": pincode,
        "contact": contact,
        "status": "pending",
        "created_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
    })
    return {"ok": True}
