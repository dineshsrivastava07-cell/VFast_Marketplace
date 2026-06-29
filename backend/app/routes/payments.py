"""Payment utilities: file upload for QR images & customer proofs, list QR for checkout."""
from __future__ import annotations

import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile

from ..security import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}


def _public_url(request: Request, filename: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/static/uploads/{filename}"


@router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only PNG/JPEG/WEBP images are allowed")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    name = f"{uuid.uuid4().hex}{ext}"
    out = UPLOAD_DIR / name
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")
    out.write_bytes(content)
    return {"url": _public_url(request, name), "filename": name}


@router.get("/qr-for-checkout")
async def qr_for_checkout(request: Request, pincode: str | None = None):
    """Return the QR image that should be displayed for the given pincode (or global fallback)."""
    db = request.state.db
    if pincode:
        qr = await db.qr_codes.find_one({"scope": "pincode", "pincode": pincode, "active": True}, {"_id": 0})
        if qr:
            return qr
    return await db.qr_codes.find_one({"scope": "global", "active": True}, {"_id": 0})
