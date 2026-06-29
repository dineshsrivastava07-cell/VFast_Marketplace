"""Finance module: GMV reports, COD reconciliation, seller settlements,
refunds, GST invoicing and CSV exports.

All routes are mounted under /api/finance and protected via require_roles.
The finance feature is read-mostly: most endpoints aggregate over the
`orders` collection. Settlements + refunds are persisted in their own
collections.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import require_roles
from ..services.audit import log_action

router = APIRouter(prefix="/api/finance", tags=["finance"])

STAFF = ("super_admin", "admin", "operations")
ADMINS = ("super_admin", "admin")


def _parse_iso(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


# --------------------------------------------------------- #
# 1. GMV / Revenue summary                                  #
# --------------------------------------------------------- #
@router.get("/summary")
async def finance_summary(
    request: Request,
    days: int = 30,
    _u=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)

    pipeline_total = [
        {"$match": {"created_at": {"$gte": start.isoformat()},
                    "status": {"$nin": ["cancelled", "payment_rejected"]}}},
        {"$group": {"_id": None, "gmv": {"$sum": "$total"},
                    "subtotal": {"$sum": "$subtotal"},
                    "delivery": {"$sum": "$delivery_fee"},
                    "orders": {"$sum": 1}}},
    ]
    summary = {"gmv": 0, "subtotal": 0, "delivery": 0, "orders": 0}
    async for row in db.orders.aggregate(pipeline_total):
        summary = {"gmv": round(row["gmv"], 2),
                   "subtotal": round(row["subtotal"], 2),
                   "delivery": round(row["delivery"], 2),
                   "orders": row["orders"]}
    aov = round(summary["gmv"] / summary["orders"], 2) if summary["orders"] else 0

    # Daily trend
    daily = []
    for d in range(days - 1, -1, -1):
        ds = (end - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        de = ds + timedelta(days=1)
        async for r in db.orders.aggregate([
            {"$match": {"created_at": {"$gte": ds.isoformat(), "$lt": de.isoformat()},
                        "status": {"$nin": ["cancelled", "payment_rejected"]}}},
            {"$group": {"_id": None, "g": {"$sum": "$total"}, "o": {"$sum": 1}}},
        ]):
            daily.append({"date": ds.strftime("%Y-%m-%d"),
                          "gmv": round(r.get("g", 0), 2),
                          "orders": r.get("o", 0)})
            break
        else:
            daily.append({"date": ds.strftime("%Y-%m-%d"), "gmv": 0, "orders": 0})

    # By payment method
    by_method = []
    async for r in db.orders.aggregate([
        {"$match": {"created_at": {"$gte": start.isoformat()},
                    "status": {"$nin": ["cancelled", "payment_rejected"]}}},
        {"$group": {"_id": "$payment_method", "gmv": {"$sum": "$total"},
                    "orders": {"$sum": 1}}},
    ]):
        by_method.append({"method": r["_id"] or "unknown",
                          "gmv": round(r["gmv"], 2), "orders": r["orders"]})

    return {"summary": {**summary, "aov": aov},
            "daily": daily, "by_method": by_method, "days": days}


# --------------------------------------------------------- #
# 2. COD reconciliation                                     #
# --------------------------------------------------------- #
@router.get("/cod-reconciliation")
async def cod_reconciliation(
    request: Request,
    rider_id: Optional[str] = None,
    _u=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    q = {"payment_method": "cod", "status": "delivered"}
    if rider_id:
        q["rider_id"] = rider_id
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).limit(1000).to_list(1000)
    summary = {
        "collected_orders": 0, "pending_orders": 0,
        "amount_collected": 0.0, "amount_pending": 0.0,
    }
    rider_totals: dict[str, dict] = {}
    for o in orders:
        rid = o.get("rider_id") or "unassigned"
        r = rider_totals.setdefault(rid, {
            "rider_id": rid, "rider_name": o.get("rider_name") or "—",
            "collected": 0.0, "pending": 0.0, "orders": 0,
        })
        r["orders"] += 1
        if o.get("payment_status") == "collected":
            summary["collected_orders"] += 1
            summary["amount_collected"] += o.get("total", 0)
            r["collected"] += o.get("total", 0)
        else:
            summary["pending_orders"] += 1
            summary["amount_pending"] += o.get("total", 0)
            r["pending"] += o.get("total", 0)
    summary["amount_collected"] = round(summary["amount_collected"], 2)
    summary["amount_pending"] = round(summary["amount_pending"], 2)
    return {"summary": summary,
            "by_rider": [{**v, "collected": round(v["collected"], 2),
                          "pending": round(v["pending"], 2)} for v in rider_totals.values()],
            "orders": orders}


@router.post("/cod-reconciliation/{order_no}/collect")
async def mark_cod_collected(
    order_no: str, request: Request, user=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    r = await db.orders.update_one(
        {"order_no": order_no, "payment_method": "cod"},
        {"$set": {"payment_status": "collected", "collected_at": now_iso()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Order not found / not COD")
    await log_action(db, user, "finance.cod_collected", "order", order_no)
    return {"ok": True}


# --------------------------------------------------------- #
# 3. Seller settlements                                     #
# --------------------------------------------------------- #
@router.get("/settlements/preview")
async def settlements_preview(
    request: Request, days: int = 30, _u=Depends(require_roles(*STAFF)),
):
    """Compute unpaid GMV per seller for the given window."""
    db = request.state.db
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    pipeline = [
        {"$match": {"created_at": {"$gte": start.isoformat()},
                    "status": "delivered"}},
        {"$unwind": "$items"},
        {"$lookup": {"from": "products", "localField": "items.product_id",
                      "foreignField": "id", "as": "p"}},
        {"$unwind": "$p"},
        {"$group": {"_id": "$p.seller_id",
                    "gmv": {"$sum": "$items.line_total"},
                    "items": {"$sum": "$items.qty"}}},
    ]
    rows = []
    async for r in db.orders.aggregate(pipeline):
        seller_id = r["_id"] or "platform"
        seller = await db.users.find_one({"id": seller_id}, {"_id": 0, "name": 1, "email": 1}) if r["_id"] else None
        commission_rate = 0.10  # 10 % platform commission
        gmv = round(r["gmv"], 2)
        commission = round(gmv * commission_rate, 2)
        payout = round(gmv - commission, 2)
        rows.append({
            "seller_id": seller_id,
            "seller_name": (seller or {}).get("name", "Platform"),
            "seller_email": (seller or {}).get("email"),
            "gmv": gmv, "items": r["items"],
            "commission_rate": commission_rate,
            "commission": commission, "payout": payout,
        })
    return {"window_days": days, "rows": rows}


@router.post("/settlements/create")
async def create_settlement(
    payload: dict, request: Request, user=Depends(require_roles(*ADMINS)),
):
    db = request.state.db
    doc = {
        "id": new_id(),
        "seller_id": payload["seller_id"],
        "seller_name": payload.get("seller_name"),
        "period_from": payload["period_from"],
        "period_to": payload["period_to"],
        "gmv": float(payload.get("gmv", 0)),
        "commission": float(payload.get("commission", 0)),
        "payout": float(payload.get("payout", 0)),
        "status": "pending",  # pending | paid
        "created_at": now_iso(),
        "created_by": user.get("email"),
    }
    await db.settlements.insert_one(doc.copy())
    await log_action(db, user, "settlement.create", "settlement", doc["id"], doc)
    doc.pop("_id", None)
    return doc


@router.get("/settlements")
async def list_settlements(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.settlements.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@router.post("/settlements/{sid}/mark-paid")
async def mark_settlement_paid(
    sid: str, payload: dict, request: Request, user=Depends(require_roles(*ADMINS)),
):
    db = request.state.db
    r = await db.settlements.update_one(
        {"id": sid},
        {"$set": {"status": "paid", "paid_at": now_iso(),
                  "utr": payload.get("utr"), "paid_by": user.get("email")}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Settlement not found")
    await log_action(db, user, "settlement.mark_paid", "settlement", sid, payload)
    return {"ok": True}


# --------------------------------------------------------- #
# 4. Refunds                                                #
# --------------------------------------------------------- #
@router.get("/refunds")
async def list_refunds(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.refunds.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@router.post("/refunds")
async def create_refund(
    payload: dict, request: Request, user=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    order_no = payload.get("order_no")
    order = await db.orders.find_one({"order_no": order_no}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    doc = {
        "id": new_id(),
        "order_no": order_no,
        "customer_phone": order.get("customer_phone"),
        "amount": float(payload.get("amount", order.get("total", 0))),
        "reason": payload.get("reason", ""),
        "mode": payload.get("mode", "upi"),  # upi | bank | cash
        "ref": payload.get("ref"),
        "status": "initiated",
        "created_at": now_iso(),
        "created_by": user.get("email"),
    }
    await db.refunds.insert_one(doc.copy())
    await log_action(db, user, "refund.create", "order", order_no, doc)
    doc.pop("_id", None)
    return doc


@router.post("/refunds/{rid}/complete")
async def complete_refund(
    rid: str, payload: dict, request: Request, user=Depends(require_roles(*ADMINS)),
):
    db = request.state.db
    r = await db.refunds.update_one(
        {"id": rid},
        {"$set": {"status": "completed", "completed_at": now_iso(),
                  "ref": payload.get("ref"), "completed_by": user.get("email")}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Refund not found")
    await log_action(db, user, "refund.complete", "refund", rid, payload)
    return {"ok": True}


# --------------------------------------------------------- #
# 5. GST invoices                                           #
# --------------------------------------------------------- #
GST_RATE = 0.05  # simplified: 5 % on FMCG-mix GST average


@router.get("/invoices/{order_no}")
async def invoice_for_order(
    order_no: str, request: Request, _u=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    order = await db.orders.find_one({"order_no": order_no}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    items = order.get("items", [])
    subtotal_excl = round(order["subtotal"] / (1 + GST_RATE), 2)
    gst_amount = round(order["subtotal"] - subtotal_excl, 2)
    invoice = {
        "invoice_no": f"INV-{order_no}",
        "order_no": order_no,
        "issued_at": now_iso(),
        "bill_to": order.get("customer_name") or "VFast Customer",
        "phone": order.get("customer_phone"),
        "address": order.get("address"),
        "items": items,
        "subtotal_excl_gst": subtotal_excl,
        "gst_rate": GST_RATE,
        "gst_amount": gst_amount,
        "delivery_fee": order.get("delivery_fee", 0),
        "total": order.get("total", 0),
        "payment_method": order.get("payment_method"),
        "seller": "V-Mart Retail Ltd.",
        "gstin": "07AAAAA0000A1Z5",
    }
    return invoice


# --------------------------------------------------------- #
# 6. CSV exports                                            #
# --------------------------------------------------------- #
@router.get("/exports/gmv")
async def export_gmv(request: Request, days: int = 30, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    end = datetime.now(timezone.utc)
    start = end - timedelta(days=days)
    orders = await db.orders.find(
        {"created_at": {"$gte": start.isoformat()},
         "status": {"$nin": ["cancelled", "payment_rejected"]}},
        {"_id": 0}).sort("created_at", -1).limit(20000).to_list(20000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["order_no", "date", "phone", "city", "pincode", "items",
                "subtotal", "delivery_fee", "total",
                "payment_method", "payment_status", "status"])
    for o in orders:
        w.writerow([o.get("order_no"), o.get("created_at"), o.get("customer_phone"),
                    o.get("address", {}).get("city"), o.get("address", {}).get("pincode"),
                    sum(i["qty"] for i in o.get("items", [])),
                    o.get("subtotal"), o.get("delivery_fee"), o.get("total"),
                    o.get("payment_method"), o.get("payment_status"), o.get("status")])
    return {"csv": buf.getvalue(), "count": len(orders), "days": days}


@router.get("/exports/settlements")
async def export_settlements(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    rows = await db.settlements.find({}, {"_id": 0}).to_list(5000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["id", "seller_id", "seller_name", "period_from", "period_to",
                "gmv", "commission", "payout", "status", "utr", "paid_at"])
    for r in rows:
        w.writerow([r.get("id"), r.get("seller_id"), r.get("seller_name"),
                    r.get("period_from"), r.get("period_to"),
                    r.get("gmv"), r.get("commission"), r.get("payout"),
                    r.get("status"), r.get("utr"), r.get("paid_at")])
    return {"csv": buf.getvalue(), "count": len(rows)}
