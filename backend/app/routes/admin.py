"""Admin/staff endpoints: PIN management, QR upload registration, payment
verification queue, order management, user management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..models import PaymentVerifyIn, PincodeIn, QRCodeIn, new_id, now_iso
from ..security import require_roles, can_admin, hash_password  # noqa: F401
from ..services.audit import log_action

VALID_ROLES = {"super_admin", "admin", "operations", "seller", "delivery_partner", "customer"}

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
async def list_users(request: Request, _u=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return users


@router.post("/users")
async def create_or_update_user(payload: dict, request: Request,
                                  user=Depends(require_roles("super_admin"))):
    """Super-admin-only: create a user by email or update if email exists.

    Body: {email, password, name, role}. Password is hashed server-side. The
    `email` field acts as the unique key — a matching record will be updated.
    """
    db = request.state.db
    email = (payload.get("email") or "").strip().lower()
    password = payload.get("password") or ""
    name = (payload.get("name") or "").strip() or email.split("@")[0].title()
    role = payload.get("role")
    if not email or not password or role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="email, password and a valid role are required")
    existing = await db.users.find_one({"email": email})
    if existing:
        await db.users.update_one(
            {"id": existing["id"]},
            {"$set": {"name": name, "role": role,
                       "password_hash": hash_password(password),
                       "updated_at": now_iso()}},
        )
        await log_action(db, user, "user.update", "user", existing["id"], {"role": role, "name": name})
        return {"ok": True, "id": existing["id"], "action": "updated"}
    new_user = {
        "id": new_id(), "email": email, "name": name, "role": role,
        "password_hash": hash_password(password), "created_at": now_iso(),
    }
    await db.users.insert_one(new_user.copy())
    await log_action(db, user, "user.create", "user", new_user["id"], {"role": role, "email": email})
    return {"ok": True, "id": new_user["id"], "action": "created"}


@router.patch("/users/{user_id}")
async def patch_user(user_id: str, payload: dict, request: Request,
                      user=Depends(require_roles("super_admin"))):
    """Super-admin-only: update name/role/password. Empty password = unchanged."""
    db = request.state.db
    existing = await db.users.find_one({"id": user_id})
    if not existing:
        raise HTTPException(status_code=404, detail="User not found")
    update: dict = {"updated_at": now_iso()}
    if "name" in payload and payload["name"]:
        update["name"] = payload["name"].strip()
    if "role" in payload and payload["role"]:
        if payload["role"] not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        update["role"] = payload["role"]
    if payload.get("password"):
        update["password_hash"] = hash_password(payload["password"])
    await db.users.update_one({"id": user_id}, {"$set": update})
    await log_action(db, user, "user.patch", "user", user_id, {k: v for k, v in update.items() if k != "password_hash"})
    return {"ok": True}


# ---------------- Products quick CRUD ---------------- #
@router.get("/products")
async def admin_products(request: Request, _u=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    return await db.products.find({}, {"_id": 0}).to_list(500)
