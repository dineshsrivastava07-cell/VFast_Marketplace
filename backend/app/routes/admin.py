"""Admin/staff endpoints: PIN management, QR upload registration, payment
verification queue, order management, user management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from typing import Optional

from ..models import PaymentVerifyIn, PincodeIn, QRCodeIn, new_id, now_iso
from ..security import require_roles, can_admin, hash_password  # noqa: F401
from ..services.audit import log_action
from .auth import is_staff_email

VALID_ROLES = {"super_admin", "admin", "operations", "seller", "delivery_partner", "customer"}
STAFF_ASSIGNABLE_ROLES = {"super_admin", "admin", "operations", "seller", "delivery_partner"}

router = APIRouter(prefix="/api/admin", tags=["admin"])


# ---------------- Dashboard ---------------- #
@router.get("/dashboard")
async def admin_dashboard(request: Request, _user=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    total_orders = await db.orders.count_documents({})
    pending_verification = await db.orders.count_documents({"status": "payment_verifying"})
    delivered = await db.orders.count_documents({"status": "delivered"})
    active_pins = await db.serviceable_pincodes.count_documents({"active": True})
    products = await db.products.count_documents({})
    gmv_pipeline = [{"$match": {"status": {"$ne": "cancelled"}}}, {"$group": {"_id": None, "gmv": {"$sum": "$total"}}}]
    gmv = 0
    async for row in db.orders.aggregate(gmv_pipeline):
        gmv = row.get("gmv", 0)
    recent = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(10).to_list(10)
    return {
        "total_orders": total_orders,
        "delivered": delivered,
        "pending_verification": pending_verification,
        "active_pincodes": active_pins,
        "products": products,
        "gmv": round(gmv, 2),
        "recent_orders": recent,
    }


# ---------------- Pincode management ---------------- #
@router.get("/pincodes")
async def list_pincodes(request: Request, _u=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    return await db.serviceable_pincodes.find({}, {"_id": 0}).to_list(2000)


@router.post("/pincodes")
async def upsert_pincode(payload: PincodeIn, request: Request, _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    doc = payload.model_dump()
    doc["updated_at"] = now_iso()
    existing = await db.serviceable_pincodes.find_one({"pincode": doc["pincode"]})
    if existing:
        await db.serviceable_pincodes.update_one({"pincode": doc["pincode"]}, {"$set": doc})
    else:
        doc["id"] = new_id()
        doc["created_at"] = now_iso()
        await db.serviceable_pincodes.insert_one(doc)
    return {"ok": True}


@router.delete("/pincodes/{pincode}")
async def delete_pincode(pincode: str, request: Request, _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    await db.serviceable_pincodes.delete_one({"pincode": pincode})
    return {"ok": True}


# ---------------- QR codes ---------------- #
@router.get("/qr-codes")
async def list_qrs(request: Request, _u=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    return await db.qr_codes.find({}, {"_id": 0}).to_list(200)


@router.post("/qr-codes")
async def upsert_qr(payload: QRCodeIn, request: Request, _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    doc = payload.model_dump()
    doc["id"] = new_id()
    doc["created_at"] = now_iso()
    await db.qr_codes.insert_one(doc)
    return {"ok": True, "id": doc["id"]}


@router.delete("/qr-codes/{qr_id}")
async def delete_qr(qr_id: str, request: Request, _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    await db.qr_codes.delete_one({"id": qr_id})
    return {"ok": True}


# ---------------- Orders / OMS ---------------- #
@router.get("/orders")
async def admin_orders(
    request: Request,
    status: str | None = Query(default=None),
    payment_method: str | None = Query(default=None),
    limit: int = Query(default=100, le=500),
    _u=Depends(require_roles("super_admin", "admin", "operations")),
):
    db = request.state.db
    filt: dict = {}
    if status:
        filt["status"] = status
    if payment_method:
        filt["payment_method"] = payment_method
    return await db.orders.find(filt, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)


@router.post("/orders/{order_no}/verify-payment")
async def verify_payment(
    order_no: str,
    payload: PaymentVerifyIn,
    request: Request,
    _u=Depends(require_roles("super_admin", "admin", "operations")),
):
    db = request.state.db
    order = await db.orders.find_one({"order_no": order_no})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if payload.status == "verified":
        new_status = "packed"
        await db.orders.update_one(
            {"order_no": order_no},
            {
                "$set": {"payment_status": "verified", "status": new_status},
                "$push": {"timeline": [
                    {"status": "payment_verified", "at": now_iso()},
                    {"status": new_status, "at": now_iso()},
                ]},
            },
        )
    elif payload.status == "rejected":
        await db.orders.update_one(
            {"order_no": order_no},
            {
                "$set": {"payment_status": "rejected", "status": "payment_rejected",
                          "rejection_reason": payload.reason or "Payment proof rejected"},
                "$push": {"timeline": {"status": "payment_rejected", "at": now_iso()}},
            },
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid status")
    return {"ok": True}


@router.post("/orders/{order_no}/advance")
async def advance_order(
    order_no: str,
    payload: dict,
    request: Request,
    _u=Depends(require_roles("super_admin", "admin", "operations")),
):
    db = request.state.db
    new_status = payload.get("status")
    valid = {"packed", "out_for_delivery", "delivered", "cancelled"}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail="Invalid target status")
    await db.orders.update_one(
        {"order_no": order_no},
        {"$set": {"status": new_status},
         "$push": {"timeline": {"status": new_status, "at": now_iso()}}},
    )
    return {"ok": True}


# ---------------- Users / roles ---------------- #
@router.get("/users")
async def list_users(request: Request, role: Optional[str] = None,
                      _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    q = {"role": role} if role else {}
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).to_list(2000)
    # default active=True if field is missing on legacy records
    for u in users:
        u.setdefault("active", True)
    return users


@router.post("/users")
async def create_or_update_user(payload: dict, request: Request,
                                  user=Depends(require_roles("super_admin"))):
    """Super-admin-only: create a user by email or update if email exists."""
    db = request.state.db
    email = (payload.get("email") or "").strip().lower()
    role = payload.get("role")
    # Staff/seller/rider must be from allowlisted email domains.
    # Customer accounts may be any email (they typically log in via phone OTP / Google).
    if role in STAFF_ASSIGNABLE_ROLES and not is_staff_email(email):
        raise HTTPException(400, detail="Email must be from @vmart.co.in, @vmartretail.com, @limeroad.com, or the two approved personal addresses.")
    password = payload.get("password") or ""
    name = (payload.get("name") or "").strip() or email.split("@")[0].title()
    if not email or not password or role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="email, password and a valid role are required")
    existing = await db.users.find_one({"email": email})
    welcome_target = email
    welcome_name = name
    extra_fields = {}
    # Optional rider-specific fields (consolidated rider creation here)
    if role == "delivery_partner":
        extra_fields = {
            "phone": payload.get("phone", ""),
            "vehicle": payload.get("vehicle", "bike"),
            "kyc": payload.get("kyc", {"pan": "", "license": "", "verified": False}),
            "rider_status": payload.get("rider_status", "offline"),
        }
    if existing:
        update_set = {"name": name, "role": role,
                       "password_hash": hash_password(password),
                       "updated_at": now_iso(), **extra_fields}
        await db.users.update_one({"id": existing["id"]}, {"$set": update_set})
        await log_action(db, user, "user.update", "user", existing["id"], {"role": role, "name": name})
        result = {"ok": True, "id": existing["id"], "action": "updated"}
    else:
        new_user = {
            "id": new_id(), "email": email, "name": name, "role": role,
            "password_hash": hash_password(password), "active": True,
            "created_at": now_iso(), **extra_fields,
        }
        await db.users.insert_one(new_user.copy())
        await log_action(db, user, "user.create", "user", new_user["id"], {"role": role, "email": email})
        result = {"ok": True, "id": new_user["id"], "action": "created"}
    # Optional welcome email (mocked when EMAIL_API_KEY missing)
    if payload.get("send_welcome", True):
        try:
            from ..services.email import send_email, welcome_html
            await send_email(welcome_target, "Welcome to VFast",
                              welcome_html(welcome_name, role, welcome_target, password),
                              tag="user-welcome")
        except Exception:
            pass
    return result


@router.patch("/users/{user_id}")
async def patch_user(user_id: str, payload: dict, request: Request,
                      user=Depends(require_roles("super_admin", "admin"))):
    """Super-admins can change anything. Admins can ONLY toggle `active` (deactivate/reactivate).
    No user is ever hard-deleted — use `active=false` to disable accounts."""
    db = request.state.db
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    actor_role = user.get("role")
    update: dict = {"updated_at": now_iso()}
    if actor_role == "admin":
        # Admins are limited to active toggle only.
        if set(payload.keys()) - {"active"}:
            raise HTTPException(status_code=403, detail="Admins can only activate/deactivate users. Ask a super admin to edit details.")
        if "active" not in payload:
            raise HTTPException(status_code=400, detail="Nothing to update")
        update["active"] = bool(payload["active"])
    else:  # super_admin
        if "name" in payload and payload["name"]:
            update["name"] = payload["name"].strip()
        if "role" in payload and payload["role"]:
            if payload["role"] not in VALID_ROLES:
                raise HTTPException(status_code=400, detail="Invalid role")
            update["role"] = payload["role"]
        if payload.get("password"):
            update["password_hash"] = hash_password(payload["password"])
        if "active" in payload:
            update["active"] = bool(payload["active"])
        for k in ("phone", "vehicle", "kyc", "rider_status"):
            if k in payload:
                update[k] = payload[k]
    try:
        await db.users.update_one({"id": user_id}, {"$set": update})
    except Exception as exc:
        msg = str(exc).lower()
        if "duplicate" in msg and "phone" in msg:
            raise HTTPException(status_code=409, detail="That phone number is already linked to another user.")
        if "duplicate" in msg and "email" in msg:
            raise HTTPException(status_code=409, detail="That email is already linked to another user.")
        raise
    await log_action(db, user, "user.patch", "user", user_id, {k: v for k, v in update.items() if k != "password_hash"})
    return {"ok": True}


@router.post("/users/{user_id}/reset-password")
async def admin_reset_password(user_id: str, payload: dict, request: Request,
                                user=Depends(require_roles("super_admin"))):
    """Super-admin convenience to forcibly set a new password and (optionally) email it."""
    db = request.state.db
    new_pw = (payload.get("new_password") or "").strip()
    if len(new_pw) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(404, "User not found")
    await db.users.update_one({"id": user_id},
                              {"$set": {"password_hash": hash_password(new_pw),
                                          "updated_at": now_iso()}})
    await log_action(db, user, "user.reset_password", "user", user_id)
    if payload.get("notify", True) and existing.get("email"):
        try:
            from ..services.email import send_email, welcome_html
            await send_email(existing["email"], "Your VFast password has been reset",
                              welcome_html(existing.get("name") or "there",
                                           existing.get("role", "user"),
                                           existing["email"], new_pw),
                              tag="admin-reset")
        except Exception:
            pass
    return {"ok": True}


@router.get("/customers/{user_id}/summary")
async def customer_summary(user_id: str, request: Request,
                            _u=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    customer = await db.users.find_one({"id": user_id, "role": "customer"},
                                        {"_id": 0, "password_hash": 0})
    if not customer:
        raise HTTPException(404, "Customer not found")
    orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(500)
    addresses = await db.addresses.find({"user_id": user_id}, {"_id": 0}).to_list(20)
    total_spent = sum(o.get("total", 0) for o in orders if o.get("status") != "cancelled")
    return {
        "customer": customer,
        "order_count": len(orders),
        "total_spent": round(total_spent, 2),
        "last_order_at": orders[0]["created_at"] if orders else None,
        "addresses": addresses,
        "orders": orders[:50],
    }


# ---------------- Products quick CRUD ---------------- #
@router.get("/products")
async def admin_products(request: Request, _u=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    return await db.products.find({}, {"_id": 0}).to_list(500)
