"""Payment utilities: file upload for QR images & customer proofs, list QR for checkout.

All uploaded images are downscaled with Pillow if either side exceeds
MAX_IMAGE_DIMENSION (1600 px) so payment-proof screenshots from modern phones
(often 3000-4000 px wide) don't bloat storage or bandwidth. Aspect ratio is
preserved.
"""
from __future__ import annotations

import io
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from ..security import get_current_user

router = APIRouter(prefix="/api/payments", tags=["payments"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MIME = {"image/png", "image/jpeg", "image/jpg", "image/webp"}
MAX_BYTES = 5 * 1024 * 1024          # 5 MB raw upload cap
MAX_IMAGE_DIMENSION = 1600           # any side capped at 1600 px
JPEG_QUALITY = 85                    # reasonable size/quality tradeoff


def _public_url(request: Request, filename: str) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/static/uploads/{filename}"


def _resize_to_fit(image: Image.Image, max_side: int = MAX_IMAGE_DIMENSION) -> Image.Image:
    """Downscale `image` so neither side exceeds `max_side`, preserving aspect ratio.
    Returns the (possibly same) PIL image. Honours EXIF orientation."""
    image = ImageOps.exif_transpose(image)
    w, h = image.size
    if w <= max_side and h <= max_side:
        return image
    # Pillow's thumbnail() resizes in-place, preserving aspect ratio.
    image.thumbnail((max_side, max_side), Image.LANCZOS)
    return image


def _process_upload(raw: bytes, original_ext: str) -> tuple[bytes, str]:
    """Resize if needed and re-encode. Returns (bytes_to_write, final_ext)."""
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="Could not decode image")

    img = _resize_to_fit(img, MAX_IMAGE_DIMENSION)

    # Pick output format / extension. Keep PNG-with-alpha as PNG; everything
    # else (incl. webp without alpha) is re-encoded as JPEG for size.
    out = io.BytesIO()
    has_alpha = img.mode in {"RGBA", "LA"} or (img.mode == "P" and "transparency" in img.info)
    if has_alpha and original_ext == ".png":
        img.save(out, format="PNG", optimize=True)
        return out.getvalue(), ".png"
    if img.mode != "RGB":
        img = img.convert("RGB")
    img.save(out, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return out.getvalue(), ".jpg"


@router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(get_current_user),
):
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Only PNG/JPEG/WEBP images are allowed")
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB)")

    original_ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    processed, final_ext = _process_upload(raw, original_ext)

    name = f"{uuid.uuid4().hex}{final_ext}"
    (UPLOAD_DIR / name).write_bytes(processed)
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
