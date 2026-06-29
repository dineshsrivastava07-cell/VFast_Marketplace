"""Rider app endpoints — availability, assigned orders, accept/pickup/deliver,
proof of delivery, COD cash mark, earnings."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import now_iso
from ..security import require_roles
from ..services.audit import log_action

router = APIRouter(prefix="/api/rider", tags=["rider"])


@router.get("/me")
async def rider_me(request: Request, user=Depends(require_roles("delivery_partner"))):
    db = request.state.db
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    today_delivered = await db.orders.count_documents({"rider_id": user["id"],
                                                       "status": "delivered",
                                                       "created_at": {"$gte": today}})
    week = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
    week_delivered = await db.orders.count_documents({"rider_id": user["id"],
                                                      "status": "delivered",
                                                      "created_at": {"$gte": week}})
    lifetime = await db.orders.count_documents({"rider_id": user["id"], "status": "delivered"})
    earnings_today = round(today_delivered * 25.0, 2)
    return {
        "rider": {"id": user["id"], "name": user.get("name"), "email": user.get("email"),
                  "phone": user.get("phone"), "vehicle": user.get("vehicle"),
                  "status": user.get("rider_status", "offline")},
        "today_delivered": today_delivered,
        "week_delivered": week_delivered,
        "lifetime_delivered": lifetime,
        "earnings_today": earnings_today,
    }


@router.post("/availability")
async def set_availability(payload: dict, request: Request,
                            user=Depends(require_roles("delivery_partner"))):
    db = request.state.db
    status = payload.get("status")
    if status not in {"online", "offline"}:
        raise HTTPException(400, "Invalid status")
    await db.users.update_one({"id": user["id"]}, {"$set": {"rider_status": status}})
    await log_action(db, user, "rider.availability", "user", user["id"], {"status": status})
    return {"ok": True, "status": status}


@router.get("/orders")
async def rider_orders(request: Request, user=Depends(require_roles("delivery_partner"))):
    """Active + recent orders for this rider."""
    db = request.state.db
    active = await db.orders.find(
        {"rider_id": user["id"],
         "status": {"$in": ["packed", "out_for_delivery"]}},
        {"_id": 0}).sort("created_at", -1).to_list(50)
    recent = await db.orders.find(
        {"rider_id": user["id"], "status": {"$in": ["delivered", "cancelled"]}},
        {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    return {"active": active, "recent": recent}


@router.get("/available")
async def available_orders(request: Request, _u=Depends(require_roles("delivery_partner"))):
    """Packed orders without a rider — rider can self-assign."""
    db = request.state.db
    return await db.orders.find(
        {"status": "packed", "rider_id": {"$in": [None, ""]}},
        {"_id": 0}).sort("created_at", 1).limit(50).to_list(50)


@router.post("/orders/{order_no}/accept")
async def accept_order(order_no: str, request: Request,
                        user=Depends(require_roles("delivery_partner"))):
    db = request.state.db
    order = await db.orders.find_one({"order_no": order_no})
    if not order:
        raise HTTPException(404, "Order not found")
    if order.get("rider_id"):
        raise HTTPException(400, "Already assigned")
    await db.orders.update_one(
        {"order_no": order_no},
        {"$set": {"rider_id": user["id"], "rider_name": user.get("name")},
         "$push": {"timeline": {"status": "rider_assigned", "at": now_iso(),
                                  "rider_id": user["id"]}}},
    )
    await log_action(db, user, "rider.accept", "order", order_no)
    return {"ok": True}


@router.post("/orders/{order_no}/pickup")
async def rider_pickup(order_no: str, request: Request,
                        user=Depends(require_roles("delivery_partner"))):
    db = request.state.db
    r = await db.orders.update_one(
        {"order_no": order_no, "rider_id": user["id"]},
        {"$set": {"status": "out_for_delivery"},
         "$push": {"timeline": {"status": "out_for_delivery", "at": now_iso()}}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Order not found or not yours")
    await db.users.update_one({"id": user["id"]}, {"$set": {"rider_status": "on_delivery"}})
    await log_action(db, user, "rider.pickup", "order", order_no)
    return {"ok": True}


@router.post("/orders/{order_no}/deliver")
async def rider_deliver(order_no: str, payload: dict, request: Request,
                         user=Depends(require_roles("delivery_partner"))):
    """Mark delivered with proof-of-delivery photo + signed name."""
    db = request.state.db
    pod = {
        "photo_url": payload.get("photo_url"),
        "signed_by": payload.get("signed_by"),
        "notes": payload.get("notes", ""),
        "at": now_iso(),
    }
    update = {
        "$set": {"status": "delivered", "pod": pod, "delivered_at": now_iso()},
        "$push": {"timeline": {"status": "delivered", "at": now_iso(), "pod": pod}},
    }
    if payload.get("cod_collected"):
        update["$set"].update({"payment_status": "collected", "collected_at": now_iso()})
    r = await db.orders.update_one(
        {"order_no": order_no, "rider_id": user["id"]}, update,
    )
    if not r.matched_count:
        raise HTTPException(404, "Order not found or not yours")
    await db.users.update_one({"id": user["id"]}, {"$set": {"rider_status": "online"}})
    await log_action(db, user, "rider.deliver", "order", order_no, pod)
    try:
        from .realtime import broadcast_order_event
        order = await db.orders.find_one({"order_no": order_no}, {"_id": 0})
        await broadcast_order_event("order.delivered", order)
    except Exception:
        pass
    return {"ok": True}


@router.post("/orders/{order_no}/cod-collected")
async def rider_cod_mark(order_no: str, request: Request,
                          user=Depends(require_roles("delivery_partner"))):
    db = request.state.db
    r = await db.orders.update_one(
        {"order_no": order_no, "rider_id": user["id"], "payment_method": "cod"},
        {"$set": {"payment_status": "collected", "collected_at": now_iso()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Order not found / not COD / not yours")
    await log_action(db, user, "rider.cod_collected", "order", order_no)
    return {"ok": True}


@router.get("/earnings")
async def earnings(request: Request, user=Depends(require_roles("delivery_partner"))):
    db = request.state.db
    end = datetime.now(timezone.utc)
    out = []
    for d in range(13, -1, -1):
        ds = (end - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        delivered = await db.orders.count_documents(
            {"rider_id": user["id"], "status": "delivered",
             "created_at": {"$gte": ds.isoformat(), "$lt": de.isoformat()}})
        out.append({"date": ds.strftime("%Y-%m-%d"), "deliveries": delivered,
                    "earnings": round(delivered * 25.0, 2)})
    total = sum(r["earnings"] for r in out)
    return {"daily": out, "total_14d": round(total, 2)}
