"""Seller portal endpoints — KYC, seller-scoped catalog + orders + payouts."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import require_roles, get_current_user
from ..services.audit import log_action

router = APIRouter(prefix="/api/seller", tags=["seller"])

SELLER = ("seller",)


# ============================================================
# KYC
# ============================================================
@router.get("/kyc")
async def get_kyc(request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    kyc = await db.seller_kyc.find_one({"seller_id": user["id"]}, {"_id": 0}) or {
        "seller_id": user["id"],
        "status": "not_submitted",
    }
    return kyc


@router.post("/kyc")
async def submit_kyc(payload: dict, request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    doc = {
        "id": new_id(),
        "seller_id": user["id"],
        "business_name": payload.get("business_name", ""),
        "gstin": payload.get("gstin", ""),
        "pan": payload.get("pan", ""),
        "fssai": payload.get("fssai", ""),
        "address": payload.get("address", ""),
        "city": payload.get("city", ""),
        "state": payload.get("state", ""),
        "pincode": payload.get("pincode", ""),
        "bank_name": payload.get("bank_name", ""),
        "bank_account": payload.get("bank_account", ""),
        "ifsc": payload.get("ifsc", ""),
        "documents": payload.get("documents", []),  # urls of uploaded docs
        "status": "pending_review",
        "submitted_at": now_iso(),
    }
    existing = await db.seller_kyc.find_one({"seller_id": user["id"]})
    if existing:
        doc["id"] = existing["id"]
        await db.seller_kyc.update_one({"id": existing["id"]}, {"$set": doc})
    else:
        await db.seller_kyc.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.get("/admin/kyc")
async def list_kyc_admin(request: Request, _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    return await db.seller_kyc.find({}, {"_id": 0}).sort("submitted_at", -1).to_list(500)


@router.post("/admin/kyc/{kyc_id}/approve")
async def approve_kyc(kyc_id: str, payload: dict, request: Request,
                      user=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    status = payload.get("status", "approved")
    if status not in {"approved", "rejected"}:
        raise HTTPException(400, "Invalid status")
    r = await db.seller_kyc.update_one(
        {"id": kyc_id},
        {"$set": {"status": status, "reviewed_at": now_iso(),
                  "reviewed_by": user.get("email"),
                  "reject_reason": payload.get("reason", "")}},
    )
    if not r.matched_count:
        raise HTTPException(404, "KYC record not found")
    await log_action(db, user, f"seller.kyc.{status}", "seller_kyc", kyc_id)
    return {"ok": True}


# ============================================================
# Seller-scoped catalog
# ============================================================
@router.get("/products")
async def my_products(request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    return await db.products.find({"seller_id": user["id"]}, {"_id": 0}).to_list(500)


@router.get("/dashboard")
async def seller_dashboard(request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    products = await db.products.count_documents({"seller_id": user["id"]})
    pids = [p["id"] for p in await db.products.find({"seller_id": user["id"]}, {"_id": 0, "id": 1}).to_list(2000)]

    # Orders that contain at least one of my products
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    week = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    today_orders = 0
    today_gmv = 0
    week_gmv = 0
    pending_fulfilment = 0
    out_of_stock = await db.products.count_documents({"seller_id": user["id"], "in_stock": False})
    async for o in db.orders.find({"items.product_id": {"$in": pids}},
                                   {"_id": 0, "created_at": 1, "items": 1, "status": 1}):
        seller_revenue = sum(i["line_total"] for i in o["items"] if i["product_id"] in pids)
        if o["created_at"] >= today:
            today_orders += 1
            today_gmv += seller_revenue
        if o["created_at"] >= week:
            week_gmv += seller_revenue
        if o.get("status") in {"placed", "packed"}:
            pending_fulfilment += 1
    kyc = await db.seller_kyc.find_one({"seller_id": user["id"]}, {"_id": 0})
    return {
        "products": products,
        "out_of_stock": out_of_stock,
        "today_orders": today_orders,
        "today_gmv": round(today_gmv, 2),
        "week_gmv": round(week_gmv, 2),
        "pending_fulfilment": pending_fulfilment,
        "kyc_status": (kyc or {}).get("status", "not_submitted"),
    }


@router.get("/orders")
async def seller_orders(request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    pids = [p["id"] for p in await db.products.find({"seller_id": user["id"]}, {"_id": 0, "id": 1}).to_list(2000)]
    if not pids:
        return []
    orders = await db.orders.find({"items.product_id": {"$in": pids}}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    # Filter items to only the seller's
    for o in orders:
        my_items = [i for i in o.get("items", []) if i["product_id"] in pids]
        o["my_items"] = my_items
        o["my_revenue"] = round(sum(i["line_total"] for i in my_items), 2)
    return orders


@router.post("/orders/{order_no}/mark-packed")
async def seller_mark_packed(order_no: str, request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    pids = [p["id"] for p in await db.products.find({"seller_id": user["id"]}, {"_id": 0, "id": 1}).to_list(2000)]
    order = await db.orders.find_one({"order_no": order_no, "items.product_id": {"$in": pids}})
    if not order:
        raise HTTPException(404, "Order not found or not yours")
    await db.orders.update_one(
        {"order_no": order_no},
        {"$set": {"status": "packed"},
         "$push": {"timeline": {"status": "packed", "at": now_iso(),
                                 "by_seller": user.get("email")}}},
    )
    await log_action(db, user, "seller.mark_packed", "order", order_no)
    return {"ok": True}


# ============================================================
# Payouts (settlements scoped to the seller)
# ============================================================
@router.get("/payouts")
async def my_payouts(request: Request, user=Depends(require_roles("seller"))):
    db = request.state.db
    return await db.settlements.find({"seller_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
