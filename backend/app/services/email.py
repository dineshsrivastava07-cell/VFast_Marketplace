"""Transactional email service (Resend) with DB-config + env fallback + mock log.

Resolution order for credentials:
1. DB settings document (`settings.email_config.api_key` / `from`)  — set via Admin UI
2. Environment variables (EMAIL_API_KEY / EMAIL_FROM)
3. Otherwise -> MOCK (logged to backend)
"""
from __future__ import annotations

import logging
import os

import httpx

log = logging.getLogger("vfast.email")
RESEND_URL = "https://api.resend.com/emails"

# Cache mutated by `apply_email_config` from admin settings save.
_RUNTIME_CFG: dict = {"api_key": "", "sender": ""}


def apply_email_config(api_key: str | None, sender: str | None) -> None:
    """Called by /admin/settings POST so changes take effect without restart."""
    _RUNTIME_CFG["api_key"] = (api_key or "").strip()
    _RUNTIME_CFG["sender"] = (sender or "").strip()


def _resolve_creds() -> tuple[str, str]:
    api_key = _RUNTIME_CFG.get("api_key") or os.environ.get("EMAIL_API_KEY", "")
    sender = _RUNTIME_CFG.get("sender") or os.environ.get("EMAIL_FROM", "")
    # If no explicit "Name <email>" sender was set but we know the brand and a
    # bare email is available, synthesise one. Otherwise leave empty -> mock.
    if not sender:
        name = os.environ.get("EMAIL_FROM_NAME", "VFast").strip()
        bare = os.environ.get("EMAIL_FROM_ADDRESS", "").strip()
        if bare:
            sender = f"{name} <{bare}>"
    return api_key, sender


async def send_email(to: str, subject: str, html: str, tag: str = "transactional") -> bool:
    api_key, sender = _resolve_creds()
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
    base = os.environ.get("APP_URL", "https://vfast.co.in")
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <h2 style="color:#E4002B">Welcome to VFast Marketplace</h2>
      <p>Hi {name},</p>
      <p>Your seller KYC has been approved. You can now log in to the Seller Portal and start listing products.</p>
      <p><a href="{base}/seller/login" style="background:#E4002B;color:white;padding:10px 18px;border-radius:8px;text-decoration:none">Open Seller Portal</a></p>
    </div>
    """


def rider_onboarding_html(name: str) -> str:
    base = os.environ.get("APP_URL", "https://vfast.co.in")
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <h2 style="color:#E4002B">Welcome to VFast Rider</h2>
      <p>Hi {name}, your rider account is active.</p>
      <p>Open the rider app, set yourself <b>Online</b>, and you&apos;ll start receiving delivery requests in serviceable PIN codes.</p>
      <p><a href="{base}/rider/login" style="background:#E4002B;color:white;padding:10px 18px;border-radius:8px;text-decoration:none">Open Rider App</a></p>
    </div>
    """


def password_reset_html(name: str, link: str) -> str:
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <h2 style="color:#E4002B">Reset your VFast password</h2>
      <p>Hi {name},</p>
      <p>We received a request to reset your VFast staff password. Click the button below to set a new one — this link expires in 2 hours.</p>
      <p><a href="{link}" style="background:#E4002B;color:white;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:700">Reset password</a></p>
      <p style="font-size:12px;color:#888">If the button doesn't work, paste this URL in your browser:<br><code>{link}</code></p>
      <p style="font-size:12px;color:#888">If you didn't request this, you can safely ignore this email.</p>
    </div>
    """


def welcome_html(name: str, role: str, email: str, password: str | None = None) -> str:
    base = os.environ.get("APP_URL", "https://vfast.co.in")
    pw_block = f"<p>Temporary password: <b>{password}</b><br>Please log in and change it from your profile.</p>" if password else ""
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:540px;margin:0 auto;padding:24px">
      <h2 style="color:#E4002B">Welcome to VFast</h2>
      <p>Hi {name},</p>
      <p>Your VFast {role.replace('_',' ')} account is ready.</p>
      <p>Email: <b>{email}</b></p>
      {pw_block}
      <p><a href="{base}" style="background:#E4002B;color:white;padding:10px 18px;border-radius:8px;text-decoration:none">Open VFast</a></p>
    </div>
    """


def otp_html(code: str) -> str:
    return f"""
    <div style="font-family:Inter,Arial,sans-serif;max-width:420px;margin:0 auto;padding:24px;text-align:center">
      <h2 style="color:#E4002B">Your VFast verification code</h2>
      <div style="font-size:36px;letter-spacing:8px;font-weight:800;background:#FDE6EA;color:#E4002B;border-radius:12px;padding:18px;margin:14px 0">{code}</div>
      <p style="color:#666;font-size:12px">Valid for 10 minutes. Don't share this code with anyone.</p>
    </div>
    """
