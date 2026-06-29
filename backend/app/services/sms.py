"""Pluggable SMS sender. Phase 1 uses 'mock' which only logs the OTP."""
from __future__ import annotations

import logging
import os

log = logging.getLogger("vfast.sms")


async def send_otp_sms(phone: str, code: str) -> bool:
    provider = os.environ.get("SMS_PROVIDER", "mock")
    if provider == "mock":
        log.info("[MOCK SMS] %s -> Your VFast OTP is %s", phone, code)
        return True
    # Future providers (MSG91 / Twilio) plug in here driven by env vars.
    log.warning("SMS_PROVIDER=%s not implemented, falling back to mock", provider)
    return True
