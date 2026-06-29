"""CRM module: customer list with order history & lifetime value, segments,
and support tickets.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import require_roles, get_current_user
from ..services.audit import log_action

router = APIRouter(prefix="/api/crm", tags=["crm"])

STAFF = ("super_admin", "admin", "operations")


@router.get("/customers")
async def list_customers(
    request: Request,
    q: Optional[str] = None,
    segment: Optional[str] = None,  # active | inactive | new
    limit: int = 200,
    _u=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    base = {"role": "customer"}
    if q:
        base["$or"] = [
            {"phone": {"$regex": q, "$options": "i"}},
            {"name": {"$regex": q, "$options": "i"}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    customers = await db.users.find(base, {"_id": 0, "password_hash": 0}).to_list(limit)
    now = datetime.now(timezone.utc)
    thirty_days = (now - timedelta(days=30)).isoformat()

    out = []
    for c in customers:
        orders = await db.orders.find({"user_id": c["id"]}, {"_id": 0, "total": 1, "created_at": 1, "status": 1}).to_list(1000)
        ltv = sum(o["total"] for o in orders if o.get("status") != "cancelled")
        last_at = max((o["created_at"] for o in orders), default=None)
        is_active = last_at is not None and last_at >= thirty_days
        seg = "active" if is_active else ("inactive" if last_at else "new")
        if segment and seg != segment:
            continue
        out.append({
            **c,
            "order_count": len(orders),
            "ltv": round(ltv, 2),
            "last_order_at": last_at,
            "segment": seg,
        })
    out.sort(key=lambda x: -x["ltv"])
    return out


@router.get("/customers/{user_id}")
async def customer_detail(user_id: str, request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    c = await db.users.find_one({"id": user_id, "role": "customer"},
                                 {"_id": 0, "password_hash": 0})
    if not c:
        raise HTTPException(404, "Customer not found")
    orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    addresses = await db.addresses.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    ltv = sum(o.get("total", 0) for o in orders if o.get("status") != "cancelled")
    tickets = await db.support_tickets.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {
        "customer": c,
        "stats": {
            "order_count": len(orders),
            "ltv": round(ltv, 2),
            "aov": round(ltv / len(orders), 2) if orders else 0,
            "first_order_at": orders[-1]["created_at"] if orders else None,
            "last_order_at": orders[0]["created_at"] if orders else None,
        },
        "orders": orders,
        "addresses": addresses,
        "tickets": tickets,
    }


# ============================================================
# Support tickets
# ============================================================
@router.get("/tickets")
async def list_tickets(
    request: Request,
    status: Optional[str] = None,
    _u=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    q: dict = {}
    if status:
        q["status"] = status
    return await db.support_tickets.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@router.post("/tickets")
async def create_ticket(
    payload: dict, request: Request, user: dict = Depends(get_current_user),
):
    """Customer or staff can open a ticket."""
    db = request.state.db
    doc = {
        "id": new_id(),
        "order_no": payload.get("order_no"),
        "user_id": payload.get("user_id") or user.get("id"),
        "subject": payload.get("subject", ""),
        "body": payload.get("body", ""),
        "category": payload.get("category", "general"),  # delivery | payment | quality | general
        "status": "open",
        "priority": payload.get("priority", "normal"),
        "created_at": now_iso(),
        "messages": [{"by": user.get("email") or user.get("phone"), "body": payload.get("body", ""), "at": now_iso()}],
    }
    await db.support_tickets.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.post("/tickets/{tid}/reply")
async def reply_ticket(
    tid: str, payload: dict, request: Request, user: dict = Depends(get_current_user),
):
    db = request.state.db
    msg = {"by": user.get("email") or user.get("phone"), "body": payload.get("body", ""), "at": now_iso()}
    r = await db.support_tickets.update_one(
        {"id": tid}, {"$push": {"messages": msg}, "$set": {"updated_at": now_iso()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Ticket not found")
    return {"ok": True}


@router.post("/tickets/{tid}/status")
async def set_ticket_status(
    tid: str, payload: dict, request: Request, user=Depends(require_roles(*STAFF)),
):
    db = request.state.db
    status = payload.get("status")
    if status not in {"open", "in_progress", "resolved", "closed"}:
        raise HTTPException(400, "Invalid status")
    r = await db.support_tickets.update_one(
        {"id": tid}, {"$set": {"status": status, "updated_at": now_iso()}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Ticket not found")
    await log_action(db, user, "ticket.status", "ticket", tid, {"status": status})
    return {"ok": True}
