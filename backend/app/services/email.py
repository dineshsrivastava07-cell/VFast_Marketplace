"""Resend transactional email service with mock fallback.

Env vars:
- EMAIL_API_KEY: Resend API key (starts with `re_...`)
- EMAIL_FROM:    Verified sender (e.g. "VFast <orders@vfast.co.in>")
"""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger("vfast.email")
RESEND_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str, tag: str = "transactional") -> bool:
    api_key = os.environ.get("EMAIL_API_KEY")
    sender = os.environ.get("EMAIL_FROM")
    if not (api_key and sender) or not to:
        log.info("[MOCK EMAIL] tag=%s to=%s subject=%s", tag, to, subject)
        return True
    payload = {"from": sender, "to": [to], "subject": subject, "html": html,
               "tags": [{"name": "type", "value": tag}]}
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(RESEND_URL, json=payload,
                                   headers={"Authorization": f"Bearer {api_key}",
                                            "Content-Type": "application/json"})
        log.info("Resend response %s: %s", r.status_code, r.text[:200])
        return r.status_code < 300
    except Exception as exc:
        log.error("Resend send failed: %s", exc)
        return False


# ---- ready-to-use templates ----
def order_confirmation_html(order_no: str, total: float, items: list, customer_name: str = "Customer") -> str:
    rows = "".join(
        f"<tr><td style='padding:6px 0'>{i.get('name','')}</td>"
        f"<td style='text-align:right;padding:6px 0'>× {i.get('qty','')}</td>"
        f"<td style='text-align:right;padding:6px 0'>₹{i.get('line_total','')}</td></tr>"
        for i in items
    )
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <div style="background:#E4002B;color:white;padding:16px;border-radius:12px 12px 0 0;font-weight:700;font-size:18px">VFast — Order confirmed</div>
      <div style="border:1px solid #f0f0f0;border-top:none;border-radius:0 0 12px 12px;padding:18px">
        <p>Hi {customer_name}, your order <b>{order_no}</b> is confirmed and being packed.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">{rows}</table>
        <hr style="border:none;border-top:1px solid #f0f0f0;margin:10px 0" />
        <div style="text-align:right;font-weight:700">Total: ₹{total}</div>
        <p style="color:#666;font-size:12px;margin-top:14px">Track your order in the VFast app. A V-Mart Retail Ltd. company.</p>
      </div>
    </div>
    """


def seller_approval_html(name: str) -> str:
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <h2 style="color:#E4002B">Welcome to VFast Marketplace</h2>
      <p>Hi {name},</p>
      <p>Your seller KYC has been approved. You can now log in to the Seller Portal and start listing products.</p>
      <p><a href="https://vfast.co.in/seller/login" style="background:#E4002B;color:white;padding:10px 18px;border-radius:8px;text-decoration:none">Open Seller Portal</a></p>
    </div>
    """


def rider_onboarding_html(name: str) -> str:
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <h2 style="color:#E4002B">Welcome to VFast Rider</h2>
      <p>Hi {name}, your rider account is active.</p>
      <p>Open the rider app, set yourself <b>Online</b>, and you'll start receiving delivery requests in serviceable PIN codes.</p>
      <p><a href="https://vfast.co.in/rider/login" style="background:#E4002B;color:white;padding:10px 18px;border-radius:8px;text-decoration:none">Open Rider App</a></p>
    </div>
    """
