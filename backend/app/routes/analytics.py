"""Analytics — revenue trend, AOV, repeat-rate, top SKUs, top categories,
geo distribution."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Request

from ..security import require_roles

router = APIRouter(prefix="/api/analytics", tags=["analytics"])

STAFF = ("super_admin", "admin", "operations")


@router.get("/overview")
async def overview(request: Request, days: int = 30, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    prev_start = start - timedelta(days=days)
    base = {"created_at": {"$gte": start.isoformat()},
            "status": {"$nin": ["cancelled", "payment_rejected"]}}
    prev_base = {"created_at": {"$gte": prev_start.isoformat(), "$lt": start.isoformat()},
                 "status": {"$nin": ["cancelled", "payment_rejected"]}}

    async def _agg(filt):
        async for r in db.orders.aggregate([
            {"$match": filt},
            {"$group": {"_id": None, "gmv": {"$sum": "$total"}, "orders": {"$sum": 1},
                        "customers": {"$addToSet": "$user_id"}}},
        ]):
            return {"gmv": round(r.get("gmv", 0), 2),
                    "orders": r.get("orders", 0),
                    "unique_customers": len(r.get("customers", []))}
        return {"gmv": 0, "orders": 0, "unique_customers": 0}

    cur = await _agg(base)
    prev = await _agg(prev_base)

    def _delta(a, b):
        if not b:
            return 100 if a else 0
        return round(((a - b) / b) * 100, 1)

    aov = round(cur["gmv"] / cur["orders"], 2) if cur["orders"] else 0
    prev_aov = round(prev["gmv"] / prev["orders"], 2) if prev["orders"] else 0

    # Repeat rate
    users_in_window = await db.orders.distinct("user_id", base)
    repeat = 0
    for uid in users_in_window:
        cnt = await db.orders.count_documents({"user_id": uid, "created_at": {"$gte": start.isoformat()}})
        if cnt > 1:
            repeat += 1
    repeat_rate = round((repeat / len(users_in_window)) * 100, 1) if users_in_window else 0

    return {
        "window_days": days,
        "current": {**cur, "aov": aov, "repeat_rate": repeat_rate},
        "previous": {**prev, "aov": prev_aov},
        "deltas": {
            "gmv": _delta(cur["gmv"], prev["gmv"]),
            "orders": _delta(cur["orders"], prev["orders"]),
            "aov": _delta(aov, prev_aov),
            "customers": _delta(cur["unique_customers"], prev["unique_customers"]),
        },
    }


@router.get("/revenue-trend")
async def revenue_trend(request: Request, days: int = 30, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    end = datetime.now(timezone.utc)
    out = []
    for d in range(days - 1, -1, -1):
        ds = (end - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        gmv, orders = 0, 0
        async for r in db.orders.aggregate([
            {"$match": {"created_at": {"$gte": ds.isoformat(), "$lt": de.isoformat()},
                        "status": {"$nin": ["cancelled", "payment_rejected"]}}},
            {"$group": {"_id": None, "g": {"$sum": "$total"}, "o": {"$sum": 1}}},
        ]):
            gmv = round(r["g"], 2); orders = r["o"]
        out.append({"date": ds.strftime("%Y-%m-%d"), "gmv": gmv, "orders": orders})
    return out


@router.get("/top-products")
async def top_products(request: Request, days: int = 30, limit: int = 20,
                       _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": start},
                    "status": {"$nin": ["cancelled", "payment_rejected"]}}},
        {"$unwind": "$items"},
        {"$group": {"_id": {"id": "$items.product_id", "name": "$items.name"},
                    "qty": {"$sum": "$items.qty"},
                    "revenue": {"$sum": "$items.line_total"}}},
        {"$sort": {"revenue": -1}},
        {"$limit": limit},
    ]
    rows = []
    async for r in db.orders.aggregate(pipeline):
        rows.append({
            "product_id": r["_id"].get("id"),
            "name": r["_id"].get("name"),
            "qty_sold": r["qty"],
            "revenue": round(r["revenue"], 2),
        })
    return rows


@router.get("/top-categories")
async def top_categories(request: Request, days: int = 30, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": start},
                    "status": {"$nin": ["cancelled", "payment_rejected"]}}},
        {"$unwind": "$items"},
        {"$lookup": {"from": "products", "localField": "items.product_id",
                      "foreignField": "id", "as": "p"}},
        {"$unwind": "$p"},
        {"$lookup": {"from": "categories", "localField": "p.category_id",
                      "foreignField": "id", "as": "c"}},
        {"$unwind": "$c"},
        {"$group": {"_id": {"id": "$c.id", "name": "$c.name"},
                    "revenue": {"$sum": "$items.line_total"},
                    "qty": {"$sum": "$items.qty"}}},
        {"$sort": {"revenue": -1}},
    ]
    out = []
    async for r in db.orders.aggregate(pipeline):
        out.append({"category_id": r["_id"]["id"], "name": r["_id"]["name"],
                    "revenue": round(r["revenue"], 2), "qty": r["qty"]})
    return out


@router.get("/by-pincode")
async def by_pincode(request: Request, days: int = 30, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    start = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"created_at": {"$gte": start},
                    "status": {"$nin": ["cancelled", "payment_rejected"]}}},
        {"$group": {"_id": "$address.pincode",
                    "orders": {"$sum": 1},
                    "gmv": {"$sum": "$total"}}},
        {"$sort": {"gmv": -1}},
        {"$limit": 50},
    ]
    out = []
    async for r in db.orders.aggregate(pipeline):
        out.append({"pincode": r["_id"], "orders": r["orders"], "gmv": round(r["gmv"], 2)})
    return out
