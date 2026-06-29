"""Server-side cart (per user). The web client also keeps a local copy for
speed; this endpoint provides the authoritative total/discount calculation."""
from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import CartItemIn
from ..security import get_current_user

router = APIRouter(prefix="/api/cart", tags=["cart"])


def _line(prod: dict, qty: int) -> dict:
    return {
        "product_id": prod["id"],
        "name": prod["name"],
        "image": prod.get("image", ""),
        "price": prod["price"],
        "mrp": prod["mrp"],
        "qty": qty,
        "line_total": round(prod["price"] * qty, 2),
        "line_savings": round(max(0, (prod["mrp"] - prod["price"]) * qty), 2),
    }


async def _summarize(db, items: List[dict], pincode: str | None) -> dict:
    enriched = []
    for it in items:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p:
            continue
        enriched.append(_line(p, it["qty"]))
    subtotal = round(sum(i["line_total"] for i in enriched), 2)
    savings = round(sum(i["line_savings"] for i in enriched), 2)
    delivery_fee = 0.0
    min_order_value = 99.0
    eta_minutes = 12
    if pincode:
        s = await db.serviceable_pincodes.find_one({"pincode": pincode}, {"_id": 0})
        if s:
            delivery_fee = float(s.get("delivery_fee", 20))
            min_order_value = float(s.get("min_order_value", 99))
            eta_minutes = int(s.get("eta_minutes", 12))
    if subtotal >= 199:  # free delivery threshold
        delivery_fee = 0
    total = round(subtotal + delivery_fee, 2)
    return {
        "items": enriched,
        "subtotal": subtotal,
        "savings": savings,
        "delivery_fee": delivery_fee,
        "min_order_value": min_order_value,
        "eta_minutes": eta_minutes,
        "total": total,
        "below_minimum": subtotal < min_order_value and subtotal > 0,
        "free_delivery_threshold": 199,
    }


@router.post("/preview")
async def preview_cart(payload: dict, request: Request):
    """Compute totals for any cart payload — works for guests too."""
    db = request.state.db
    items = payload.get("items", [])
    pincode = payload.get("pincode")
    return await _summarize(db, items, pincode)


@router.get("/")
async def get_cart(request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    record = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0}) or {"items": []}
    return await _summarize(db, record.get("items", []), record.get("pincode"))


@router.post("/set")
async def set_cart(
    payload: dict,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.state.db
    items = [CartItemIn(**i).model_dump() for i in payload.get("items", [])]
    pincode = payload.get("pincode")
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "items": items, "pincode": pincode}},
        upsert=True,
    )
    return await _summarize(db, items, pincode)


@router.delete("/")
async def clear_cart(request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    await db.carts.delete_one({"user_id": user["id"]})
    return {"ok": True}
