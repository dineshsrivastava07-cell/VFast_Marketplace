"""FCM HTTP v1 push notification service with mock fallback.

Env vars:
- FCM_PROJECT_ID:           Firebase project ID
- FCM_SERVICE_ACCOUNT_FILE: Absolute path to the service account JSON (or
                            FCM_SERVICE_ACCOUNT_JSON for inline JSON content).
"""
from __future__ import annotations

import json
import logging
import os
from typing import Optional

import httpx

log = logging.getLogger("vfast.push")

_FCM_SCOPE = "https://www.googleapis.com/auth/firebase.messaging"


def _load_credentials():
    """Lazy import google.oauth2 so the dependency is only required when used."""
    try:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
    except ImportError:
        log.warning("google-auth not installed; push notifications disabled")
        return None, None

    file_path = os.environ.get("FCM_SERVICE_ACCOUNT_FILE")
    inline_json = os.environ.get("FCM_SERVICE_ACCOUNT_JSON")
    info = None
    if file_path and os.path.exists(file_path):
        with open(file_path) as f:
            info = json.load(f)
    elif inline_json:
        try:
            info = json.loads(inline_json)
        except json.JSONDecodeError:
            log.error("FCM_SERVICE_ACCOUNT_JSON is not valid JSON")
            return None, None
    if not info:
        return None, None
    creds = service_account.Credentials.from_service_account_info(info, scopes=[_FCM_SCOPE])
    creds.refresh(Request())
    return creds.token, Request


async def send_push(device_token: str, title: str, body: str,
                     data: Optional[dict] = None) -> bool:
    project_id = os.environ.get("FCM_PROJECT_ID")
    if not project_id or not device_token:
        log.info("[MOCK PUSH] %s — %s", title, body)
        return True
    access_token, _ = _load_credentials()
    if not access_token:
        log.info("[MOCK PUSH no creds] %s — %s", title, body)
        return True
    url = f"https://fcm.googleapis.com/v1/projects/{project_id}/messages:send"
    payload = {
        "message": {
            "token": device_token,
            "notification": {"title": title, "body": body},
            **({"data": {k: str(v) for k, v in (data or {}).items()}} if data else {}),
        }
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(url, json=payload,
                                   headers={"Authorization": f"Bearer {access_token}",
                                            "Content-Type": "application/json; charset=utf-8"})
        log.info("FCM response %s: %s", r.status_code, r.text[:200])
        return r.status_code < 300
    except Exception as exc:
        log.error("FCM send failed: %s", exc)
        return False
