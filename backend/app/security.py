"""JWT + bcrypt helpers, RBAC dependency."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Iterable, Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status

JWT_ALGORITHM = "HS256"
ACCESS_TTL_MIN = 60 * 24 * 7  # 7 days for demo simplicity


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def create_access_token(user_id: str, role: str, extra: Optional[dict] = None) -> str:
    payload = {
        "sub": user_id,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TTL_MIN),
        "iat": datetime.now(timezone.utc),
        "type": "access",
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])


def _extract_token(request: Request) -> Optional[str]:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    token = request.cookies.get("access_token")
    return token


async def get_current_user(request: Request) -> dict:
    token = _extract_token(request)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    db = request.state.db
    user = await db.users.find_one({"id": payload["sub"]}, {"password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    user.pop("_id", None)
    return user


def require_roles(*roles: str):
    async def dep(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user

    return dep


async def get_optional_user(request: Request) -> Optional[dict]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None


ROLES = {
    "super_admin": "Super Admin",
    "admin": "Admin",
    "operations": "Operations",
    "seller": "Seller",
    "delivery_partner": "Delivery Partner",
    "customer": "Customer",
}


def is_staff(role: str) -> bool:
    return role in {"super_admin", "admin", "operations"}


def can_admin(role: str) -> bool:
    return role in {"super_admin", "admin"}
