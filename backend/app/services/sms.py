"""MSG91 SMS service — sends OTP via Flow API v5 with graceful mock fallback.

Env vars (all optional — when any is missing we fall back to mock log + return ok):
- SMS_API_KEY: MSG91 Authkey from https://control.msg91.com (Authkey section)
- MSG91_SENDER_ID: DLT-approved 6-char sender ID (e.g. VFASTM)
- MSG91_FLOW_ID:  Flow ID of the OTP SMS flow (template variable must be named `otp`)
"""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger("vfast.sms")

MSG91_FLOW_URL = "https://control.msg91.com/api/v5/flow"


async def send_otp_sms(phone: str, code: str) -> bool:
    """Send an OTP SMS. `phone` is +91XXXXXXXXXX format. Returns True on success."""
    api_key = os.environ.get("SMS_API_KEY")
    sender = os.environ.get("MSG91_SENDER_ID")
    flow_id = os.environ.get("MSG91_FLOW_ID")
    provider = os.environ.get("SMS_PROVIDER", "mock")

    if provider == "mock" or not (api_key and sender and flow_id):
        log.info("[MOCK SMS] %s -> Your VFast OTP is %s", phone, code)
        return True

    # MSG91 expects mobile in 91XXXXXXXXXX form (no +)
    mobile = phone.replace("+", "")
    payload = {
        "flow_id": flow_id,
        "sender": sender,
        "recipients": [{"mobiles": mobile, "otp": code}],
    }
    headers = {"Content-Type": "application/json", "authkey": api_key}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(MSG91_FLOW_URL, json=payload, headers=headers)
        log.info("MSG91 response %s: %s", r.status_code, r.text[:200])
        return r.status_code < 300
    except Exception as exc:
        log.error("MSG91 send failed: %s", exc)
        return False


async def send_promo_sms(phone: str, message: str) -> bool:
    """Send a non-OTP promotional/transactional SMS (used by campaigns)."""
    api_key = os.environ.get("SMS_API_KEY")
    sender = os.environ.get("MSG91_SENDER_ID")
    flow_id = os.environ.get("MSG91_FLOW_ID_PROMO")  # separate flow recommended
    if not (api_key and sender and flow_id):
        log.info("[MOCK SMS PROMO] %s -> %s", phone, message[:60])
        return True
    mobile = phone.replace("+", "")
    payload = {"flow_id": flow_id, "sender": sender,
               "recipients": [{"mobiles": mobile, "body": message}]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(MSG91_FLOW_URL, json=payload,
                                   headers={"Content-Type": "application/json", "authkey": api_key})
        return r.status_code < 300
    except Exception:
        return False
