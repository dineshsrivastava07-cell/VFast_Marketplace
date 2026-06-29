"""DPDP Act (India) compliance console.

Features:
- Consent records (versioned, per purpose, with grant + withdrawal trail).
- Data principal rights — access/correction/erasure requests queue.
- Grievance / DPO inbox.
- Breach notification log.
- Cookie/consent banner toggle (stored in settings).
- Audit trail viewer (passthrough of existing audit_logs).
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import require_roles, get_current_user
from ..services.audit import log_action

router = APIRouter(prefix="/api/dpdp", tags=["dpdp"])

STAFF = ("super_admin", "admin", "operations")
ADMINS = ("super_admin", "admin")

CONSENT_PURPOSES = ["transactional", "marketing", "analytics", "third_party_share"]


# ============================================================
# 1. Consent records  (customer-facing + admin view)
# ============================================================
@router.post("/consents")
async def record_consent(payload: dict, request: Request,
                          user: dict = Depends(get_current_user)):
    db = request.state.db
    purpose = payload.get("purpose")
    if purpose not in CONSENT_PURPOSES:
        raise HTTPException(400, f"Invalid purpose. Allowed: {CONSENT_PURPOSES}")
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "phone": user.get("phone"),
        "email": user.get("email"),
        "purpose": purpose,
        "granted": bool(payload.get("granted", True)),
        "policy_version": payload.get("policy_version", "v1.0"),
        "ip": request.client.host if request.client else None,
        "user_agent": (request.headers.get("user-agent") or "")[:200],
        "at": now_iso(),
    }
    await db.consent_records.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.get("/consents/me")
async def my_consents(request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    rows = await db.consent_records.find({"user_id": user["id"]}, {"_id": 0}).sort("at", -1).to_list(200)
    # Build current state by purpose (latest wins)
    state = {}
    for r in rows:
        state.setdefault(r["purpose"], r)
    return {"history": rows, "current": state}


@router.get("/consents")
async def list_all_consents(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    rows = await db.consent_records.find({}, {"_id": 0}).sort("at", -1).limit(1000).to_list(1000)
    return rows


# ============================================================
# 2. Data principal rights — access / correction / erasure
# ============================================================
@router.post("/rights-requests")
async def create_rights_request(payload: dict, request: Request,
                                 user: dict = Depends(get_current_user)):
    db = request.state.db
    rtype = payload.get("type")
    if rtype not in {"access", "correction", "erasure", "portability"}:
        raise HTTPException(400, "Invalid type")
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "phone": user.get("phone"),
        "email": user.get("email"),
        "type": rtype,
        "note": payload.get("note", ""),
        "status": "open",
        "created_at": now_iso(),
    }
    await db.rights_requests.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.get("/rights-requests")
async def list_rights_requests(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.rights_requests.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@router.post("/rights-requests/{rid}/process")
async def process_rights_request(rid: str, payload: dict, request: Request,
                                  user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    req = await db.rights_requests.find_one({"id": rid})
    if not req:
        raise HTTPException(404, "Request not found")
    new_status = payload.get("status", "completed")
    update = {"status": new_status, "completed_at": now_iso(),
              "completed_by": user.get("email"),
              "resolution": payload.get("resolution", "")}
    # Erasure → anonymize the user record
    if req["type"] == "erasure" and new_status == "completed":
        await db.users.update_one(
            {"id": req["user_id"]},
            {"$set": {"name": "Deleted User", "email": None,
                       "phone": None, "deleted_at": now_iso()}},
        )
        await db.addresses.delete_many({"user_id": req["user_id"]})
        update["erasure_applied"] = True
    await db.rights_requests.update_one({"id": rid}, {"$set": update})
    await log_action(db, user, "dpdp.rights_request.process", "rights_request", rid, update)
    return {"ok": True, **update}


# ============================================================
# 3. Grievance / DPO inbox
# ============================================================
@router.post("/grievances")
async def file_grievance(payload: dict, request: Request,
                          user: dict = Depends(get_current_user)):
    db = request.state.db
    doc = {
        "id": new_id(),
        "user_id": user["id"],
        "name": payload.get("name", user.get("name") or ""),
        "contact": payload.get("contact", user.get("phone") or user.get("email") or ""),
        "category": payload.get("category", "general"),
        "subject": payload.get("subject", ""),
        "body": payload.get("body", ""),
        "status": "open",
        "created_at": now_iso(),
    }
    await db.grievances.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


@router.get("/grievances")
async def list_grievances(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.grievances.find({}, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@router.post("/grievances/{gid}/resolve")
async def resolve_grievance(gid: str, payload: dict, request: Request,
                             user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    r = await db.grievances.update_one(
        {"id": gid},
        {"$set": {"status": "resolved", "resolution": payload.get("resolution", ""),
                  "resolved_at": now_iso(), "resolved_by": user.get("email")}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Grievance not found")
    await log_action(db, user, "dpdp.grievance.resolve", "grievance", gid)
    return {"ok": True}


# ============================================================
# 4. Breach notification log
# ============================================================
@router.get("/breaches")
async def list_breaches(request: Request, _u=Depends(require_roles(*ADMINS))):
    db = request.state.db
    return await db.breaches.find({}, {"_id": 0}).sort("detected_at", -1).limit(200).to_list(200)


@router.post("/breaches")
async def log_breach(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    doc = {
        "id": new_id(),
        "title": payload.get("title", "Incident"),
        "severity": payload.get("severity", "medium"),  # low | medium | high | critical
        "detected_at": payload.get("detected_at", now_iso()),
        "users_impacted": int(payload.get("users_impacted", 0)),
        "summary": payload.get("summary", ""),
        "remediation": payload.get("remediation", ""),
        "reported_to_dpb_at": payload.get("reported_to_dpb_at"),
        "status": payload.get("status", "investigating"),
        "logged_by": user.get("email"),
        "created_at": now_iso(),
    }
    await db.breaches.insert_one(doc.copy())
    await log_action(db, user, "dpdp.breach.log", "breach", doc["id"], doc)
    doc.pop("_id", None)
    return doc


# ============================================================
# 5. Cookie consent banner toggle  (stored in settings.dpdp)
# ============================================================
@router.get("/banner-settings")
async def get_banner_settings(request: Request):
    db = request.state.db
    s = await db.settings.find_one({"key": "dpdp_banner"}, {"_id": 0}) or {
        "key": "dpdp_banner",
        "enabled": True,
        "title": "We value your privacy",
        "body": "VFast uses essential cookies for login & cart. We ask before using marketing or analytics cookies — DPDP Act, 2023.",
        "policy_url": "/privacy-policy",
        "policy_version": "v1.0",
    }
    return s


@router.post("/banner-settings")
async def set_banner_settings(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    payload["key"] = "dpdp_banner"
    payload["updated_at"] = now_iso()
    await db.settings.update_one({"key": "dpdp_banner"}, {"$set": payload}, upsert=True)
    await log_action(db, user, "dpdp.banner.update", "settings", "dpdp_banner", payload)
    return payload


# ============================================================
# 6. Overview KPIs (counts for admin dashboard)
# ============================================================
@router.get("/overview")
async def dpdp_overview(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return {
        "consents_total": await db.consent_records.count_documents({}),
        "rights_requests_open": await db.rights_requests.count_documents({"status": "open"}),
        "rights_requests_total": await db.rights_requests.count_documents({}),
        "grievances_open": await db.grievances.count_documents({"status": "open"}),
        "breaches_open": await db.breaches.count_documents({"status": {"$ne": "closed"}}),
    }
