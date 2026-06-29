"""Marketing module: banners, coupons and campaigns.

Campaigns simulate SMS / push / email sends (no real provider yet) — each
send is logged into `campaign_sends`.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import require_roles
from ..services.audit import log_action

router = APIRouter(prefix="/api/marketing", tags=["marketing"])

STAFF = ("super_admin", "admin", "operations")
ADMINS = ("super_admin", "admin")


# ============================================================
# 1. Banners
# ============================================================
@router.get("/banners")
async def list_banners(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.banners.find({}, {"_id": 0}).sort("sort_order", 1).to_list(200)


@router.post("/banners")
async def upsert_banner(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    doc = {
        "id": payload.get("id") or new_id(),
        "title": payload.get("title", ""),
        "subtitle": payload.get("subtitle", ""),
        "image": payload.get("image", ""),
        "cta": payload.get("cta", "Shop now"),
        "link": payload.get("link", "/"),
        "sort_order": int(payload.get("sort_order", 100)),
        "active": payload.get("active", True),
        "updated_at": now_iso(),
    }
    await db.banners.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await log_action(db, user, "banner.upsert", "banner", doc["id"], {"title": doc["title"]})
    return doc


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    await db.banners.delete_one({"id": banner_id})
    await log_action(db, user, "banner.delete", "banner", banner_id)
    return {"ok": True}


# ============================================================
# 2. Coupons
# ============================================================
COUPON_TYPES = {"percent", "flat", "free_delivery", "bogo"}


@router.get("/coupons")
async def list_coupons(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)


@router.post("/coupons")
async def upsert_coupon(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    code = (payload.get("code") or "").upper().strip()
    if not code:
        raise HTTPException(400, "Coupon code required")
    ctype = payload.get("type", "percent")
    if ctype not in COUPON_TYPES:
        raise HTTPException(400, f"Invalid type. Allowed: {COUPON_TYPES}")
    doc = {
        "id": payload.get("id") or new_id(),
        "code": code,
        "type": ctype,
        "value": float(payload.get("value", 0)),
        "min_order_value": float(payload.get("min_order_value", 0)),
        "max_discount": float(payload.get("max_discount", 0)) or None,
        "description": payload.get("description", ""),
        "valid_from": payload.get("valid_from"),
        "valid_to": payload.get("valid_to"),
        "usage_limit": int(payload.get("usage_limit", 0)),
        "per_user_limit": int(payload.get("per_user_limit", 1)),
        "used_count": int(payload.get("used_count", 0)),
        "active": payload.get("active", True),
        "applicable_pincodes": payload.get("applicable_pincodes", []),
        "created_at": payload.get("created_at") or now_iso(),
        "updated_at": now_iso(),
    }
    await db.coupons.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await log_action(db, user, "coupon.upsert", "coupon", doc["id"], {"code": code})
    return doc


@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    await db.coupons.delete_one({"id": coupon_id})
    await log_action(db, user, "coupon.delete", "coupon", coupon_id)
    return {"ok": True}


@router.post("/coupons/validate")
async def validate_coupon(payload: dict, request: Request):
    """Customer-facing: validate a coupon for the given subtotal+pincode."""
    db = request.state.db
    code = (payload.get("code") or "").upper().strip()
    subtotal = float(payload.get("subtotal", 0))
    pincode = payload.get("pincode")
    c = await db.coupons.find_one({"code": code, "active": True}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Invalid coupon")
    now = datetime.now(timezone.utc).isoformat()
    if c.get("valid_from") and now < c["valid_from"]:
        raise HTTPException(400, "Coupon not yet active")
    if c.get("valid_to") and now > c["valid_to"]:
        raise HTTPException(400, "Coupon expired")
    if c.get("min_order_value", 0) > subtotal:
        raise HTTPException(400, f"Min order ₹{c['min_order_value']} required")
    if c.get("applicable_pincodes") and pincode and pincode not in c["applicable_pincodes"]:
        raise HTTPException(400, "Coupon not valid for this PIN")
    if c.get("usage_limit") and c.get("used_count", 0) >= c["usage_limit"]:
        raise HTTPException(400, "Coupon usage limit reached")

    discount = 0.0
    if c["type"] == "percent":
        discount = subtotal * (c["value"] / 100.0)
        if c.get("max_discount"):
            discount = min(discount, c["max_discount"])
    elif c["type"] == "flat":
        discount = c["value"]
    elif c["type"] == "free_delivery":
        discount = 0  # caller applies delivery_fee = 0 instead
    elif c["type"] == "bogo":
        discount = subtotal * 0.5  # simplified
    discount = round(min(discount, subtotal), 2)
    return {"valid": True, "coupon": c, "discount": discount,
            "free_delivery": c["type"] == "free_delivery"}


# ============================================================
# 3. Campaigns (push / sms / email) — mock send
# ============================================================
@router.get("/campaigns")
async def list_campaigns(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.campaigns.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/campaigns")
async def create_campaign(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    channel = payload.get("channel", "sms")
    if channel not in {"sms", "email", "push", "whatsapp"}:
        raise HTTPException(400, "Invalid channel")
    doc = {
        "id": new_id(),
        "name": payload.get("name", "Untitled campaign"),
        "channel": channel,
        "subject": payload.get("subject", ""),
        "body": payload.get("body", ""),
        "segment": payload.get("segment", "all"),  # all | recent_buyers | inactive | by_pincode
        "segment_value": payload.get("segment_value"),
        "schedule_at": payload.get("schedule_at"),
        "status": "draft",  # draft | sending | sent | failed
        "sent_count": 0,
        "created_at": now_iso(),
        "created_by": user.get("email"),
    }
    await db.campaigns.insert_one(doc.copy())
    await log_action(db, user, "campaign.create", "campaign", doc["id"], doc)
    doc.pop("_id", None)
    return doc


async def _resolve_recipients(db, campaign: dict) -> list[dict]:
    seg = campaign.get("segment", "all")
    val = campaign.get("segment_value")
    base = {"role": "customer"}
    if seg == "all":
        cur = db.users.find(base, {"_id": 0, "id": 1, "phone": 1, "email": 1, "name": 1})
    elif seg == "by_pincode" and val:
        # users who placed an order from this pincode
        order_users = await db.orders.distinct("user_id", {"address.pincode": val})
        cur = db.users.find({"id": {"$in": order_users}, **base},
                            {"_id": 0, "id": 1, "phone": 1, "email": 1, "name": 1})
    elif seg == "recent_buyers":
        order_users = await db.orders.distinct("user_id", {})
        cur = db.users.find({"id": {"$in": order_users}, **base},
                            {"_id": 0, "id": 1, "phone": 1, "email": 1, "name": 1})
    elif seg == "inactive":
        order_users = await db.orders.distinct("user_id", {})
        cur = db.users.find({"id": {"$nin": order_users}, **base},
                            {"_id": 0, "id": 1, "phone": 1, "email": 1, "name": 1})
    else:
        cur = db.users.find(base, {"_id": 0, "id": 1, "phone": 1, "email": 1, "name": 1})
    return await cur.to_list(5000)


@router.post("/campaigns/{cid}/send")
async def send_campaign(cid: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    camp = await db.campaigns.find_one({"id": cid}, {"_id": 0})
    if not camp:
        raise HTTPException(404, "Campaign not found")
    recipients = await _resolve_recipients(db, camp)
    sends = []
    for r in recipients:
        target = r.get("phone") if camp["channel"] in {"sms", "whatsapp", "push"} else r.get("email")
        if not target:
            continue
        sends.append({
            "id": new_id(),
            "campaign_id": cid,
            "user_id": r.get("id"),
            "target": target,
            "channel": camp["channel"],
            "body": camp.get("body"),
            "subject": camp.get("subject"),
            "status": "sent_mock",  # MOCKED — no real SMS/email provider configured
            "sent_at": now_iso(),
        })
    if sends:
        await db.campaign_sends.insert_many(sends)
    await db.campaigns.update_one({"id": cid},
        {"$set": {"status": "sent", "sent_count": len(sends), "sent_at": now_iso()}})
    await log_action(db, user, "campaign.send", "campaign", cid,
                     {"sent_count": len(sends), "channel": camp["channel"]})
    return {"ok": True, "sent_count": len(sends), "mocked": True}


@router.get("/campaigns/{cid}/sends")
async def list_campaign_sends(cid: str, request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.campaign_sends.find({"campaign_id": cid}, {"_id": 0}).sort("sent_at", -1).limit(500).to_list(500)


@router.delete("/campaigns/{cid}")
async def delete_campaign(cid: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    await db.campaigns.delete_one({"id": cid})
    await db.campaign_sends.delete_many({"campaign_id": cid})
    await log_action(db, user, "campaign.delete", "campaign", cid)
    return {"ok": True}


# Public banners — for customer storefront
public_router = APIRouter(prefix="/api/public", tags=["public"])


@public_router.get("/banners")
async def public_banners(request: Request):
    db = request.state.db
    return await db.banners.find({"active": {"$ne": False}}, {"_id": 0}).sort("sort_order", 1).to_list(20)
