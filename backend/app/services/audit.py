"""Audit log helper — used by every privileged endpoint."""
from __future__ import annotations

from typing import Optional, Any
from ..models import new_id, now_iso


async def log_action(
    db,
    user: dict,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    details: Optional[dict[str, Any]] = None,
) -> None:
    await db.audit_logs.insert_one({
        "id": new_id(),
        "user_id": user.get("id"),
        "user_email": user.get("email"),
        "user_phone": user.get("phone"),
        "user_role": user.get("role"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
        "at": now_iso(),
    })
