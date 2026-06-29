"""Order placement, listing, tracking + UPI QR proof submit."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import CreateOrderIn, UPIProofIn, new_id, now_iso
from ..security import get_current_user, is_staff

router = APIRouter(prefix="/api/orders", tags=["orders"])


STATUS_FLOW = [
    "placed",
    "payment_pending",
    "payment_verifying",
    "packed",
    "out_for_delivery",
    "delivered",
    "cancelled",
    "payment_rejected",
]


def _gen_order_no() -> str:
    return "VF" + datetime.now().strftime("%y%m%d") + f"{random.randint(1000, 9999)}"


async def _build_line_items(db, items: List[dict]) -> List[dict]:
    lines = []
    for it in items:
        p = await db.products.find_one({"id": it["product_id"]}, {"_id": 0})
        if not p:
            continue
        lines.append({
            "product_id": p["id"],
            "name": p["name"],
            "image": p.get("image", ""),
            "price": p["price"],
            "mrp": p["mrp"],
            "qty": it["qty"],
            "line_total": round(p["price"] * it["qty"], 2),
        })
    return lines


@router.post("/")
async def create_order(
    payload: CreateOrderIn,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.state.db
    cart = await db.carts.find_one({"user_id": user["id"]}, {"_id": 0})
    if not cart or not cart.get("items"):
        raise HTTPException(status_code=400, detail="Cart is empty")

    # serviceability
    pincode = payload.address.pincode
    sp = await db.serviceable_pincodes.find_one({"pincode": pincode}, {"_id": 0})
    if not sp or not sp.get("active", True):
        raise HTTPException(status_code=400, detail="PIN code not serviceable")

    lines = await _build_line_items(db, cart["items"])
    subtotal = round(sum(li["line_total"] for li in lines), 2)
    delivery_fee = 0.0 if subtotal >= 199 else float(sp.get("delivery_fee", 20))
    total = round(subtotal + delivery_fee, 2)

    if payload.payment_method not in {"cod", "upi_qr"}:
        raise HTTPException(status_code=400, detail="Unsupported payment method")

    initial_status = "payment_pending" if payload.payment_method == "upi_qr" else "placed"

    # Pick a QR for upi_qr orders
    qr = None
    if payload.payment_method == "upi_qr":
        qr = await db.qr_codes.find_one({"scope": "pincode", "pincode": pincode, "active": True}, {"_id": 0})
        if not qr:
            qr = await db.qr_codes.find_one({"scope": "global", "active": True}, {"_id": 0})

    order = {
        "id": new_id(),
        "order_no": _gen_order_no(),
        "user_id": user["id"],
        "customer_phone": user.get("phone"),
        "customer_name": user.get("name"),
        "address": payload.address.model_dump(),
        "items": lines,
        "subtotal": subtotal,
        "delivery_fee": delivery_fee,
        "total": total,
        "payment_method": payload.payment_method,
        "payment_status": "pending",
        "status": initial_status,
        "delivery_slot": payload.delivery_slot,
        "eta_minutes": int(sp.get("eta_minutes", 12)),
        "qr_code": qr,
        "proof": None,
        "timeline": [{"status": initial_status, "at": now_iso()}],
        "created_at": now_iso(),
    }
    await db.orders.insert_one(order.copy())
    await db.carts.delete_one({"user_id": user["id"]})
    order.pop("_id", None)
    return order


@router.get("/")
async def my_orders(request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    cursor = db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1)
    return await cursor.to_list(200)


@router.get("/{order_no}")
async def get_order(order_no: str, request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    order = await db.orders.find_one({"order_no": order_no}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["user_id"] != user["id"] and not is_staff(user["role"]):
        raise HTTPException(status_code=403, detail="Forbidden")
    return order


@router.post("/{order_no}/upi-proof")
async def submit_upi_proof(
    order_no: str,
    payload: UPIProofIn,
    request: Request,
    user: dict = Depends(get_current_user),
):
    db = request.state.db
    order = await db.orders.find_one({"order_no": order_no})
    if not order or order["user_id"] != user["id"]:
        raise HTTPException(status_code=404, detail="Order not found")
    if order["payment_method"] != "upi_qr":
        raise HTTPException(status_code=400, detail="Order is not a UPI QR order")
    proof = {"utr": payload.utr, "proof_image_url": payload.proof_image_url, "submitted_at": now_iso()}
    await db.orders.update_one(
        {"order_no": order_no},
        {
            "$set": {"status": "payment_verifying", "proof": proof},
            "$push": {"timeline": {"status": "payment_verifying", "at": now_iso()}},
        },
    )
    order = await db.orders.find_one({"order_no": order_no}, {"_id": 0})
    return order


@router.post("/{order_no}/cancel")
async def cancel_order(order_no: str, request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    order = await db.orders.find_one({"order_no": order_no})
    if not order or (order["user_id"] != user["id"] and not is_staff(user["role"])):
        raise HTTPException(status_code=404, detail="Order not found")
    if order["status"] in {"delivered", "cancelled"}:
        raise HTTPException(status_code=400, detail="Cannot cancel this order")
    await db.orders.update_one(
        {"order_no": order_no},
        {
            "$set": {"status": "cancelled"},
            "$push": {"timeline": {"status": "cancelled", "at": now_iso()}},
        },
    )
    return {"ok": True}
