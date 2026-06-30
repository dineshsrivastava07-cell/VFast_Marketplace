"""Customer profile + address book."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import get_current_user

router = APIRouter(prefix="/api/customer", tags=["customer"])


@router.get("/profile")
async def get_profile(request: Request, user: dict = Depends(get_current_user)):
    return {
        "id": user["id"],
        "name": user.get("name"),
        "phone": user.get("phone"),
        "email": user.get("email"),
        "role": user.get("role"),
    }


@router.patch("/profile")
async def update_profile(payload: dict, request: Request,
                          user: dict = Depends(get_current_user)):
    db = request.state.db
    update = {k: payload[k] for k in ("name", "email") if k in payload}
    if not update:
        raise HTTPException(400, "Nothing to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update})
    return {"ok": True, **update}


@router.get("/addresses")
async def list_addresses(request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    return await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(20)


@router.post("/addresses")
async def upsert_address(payload: dict, request: Request,
                          user: dict = Depends(get_current_user)):
    db = request.state.db
    pin = (payload.get("pincode") or "").strip()
    if len(pin) != 6 or not pin.isdigit():
        raise HTTPException(400, "Invalid PIN code")
    doc = {
        "id": payload.get("id") or new_id(),
        "user_id": user["id"],
        "label": payload.get("label", "Home"),
        "flat": payload.get("flat", ""),
        "area": payload.get("area", ""),
        "landmark": payload.get("landmark", ""),
        "city": payload.get("city", ""),
        "state": payload.get("state", ""),
        "pincode": pin,
        "phone": payload.get("phone") or user.get("phone"),
        "is_default": bool(payload.get("is_default", False)),
        "created_at": payload.get("created_at") or now_iso(),
    }
    if doc["is_default"]:
        await db.addresses.update_many({"user_id": user["id"]},
                                        {"$set": {"is_default": False}})
    await db.addresses.update_one({"id": doc["id"], "user_id": user["id"]},
                                   {"$set": doc}, upsert=True)
    return doc


@router.delete("/addresses/{addr_id}")
async def delete_address(addr_id: str, request: Request,
                          user: dict = Depends(get_current_user)):
    db = request.state.db
    await db.addresses.delete_one({"id": addr_id, "user_id": user["id"]})
    return {"ok": True}


@router.patch("/addresses/{addr_id}")
async def patch_address(addr_id: str, payload: dict, request: Request,
                         user: dict = Depends(get_current_user)):
    db = request.state.db
    existing = await db.addresses.find_one({"id": addr_id, "user_id": user["id"]})
    if not existing:
        raise HTTPException(404, "Address not found")
    allowed = {"label", "flat", "area", "landmark", "city", "state", "pincode", "phone", "is_default"}
    update = {k: payload[k] for k in payload if k in allowed}
    if "pincode" in update:
        pin = str(update["pincode"]).strip()
        if len(pin) != 6 or not pin.isdigit():
            raise HTTPException(400, "Invalid PIN code")
        update["pincode"] = pin
    if update.get("is_default"):
        await db.addresses.update_many({"user_id": user["id"]},
                                        {"$set": {"is_default": False}})
    update["updated_at"] = now_iso()
    await db.addresses.update_one({"id": addr_id, "user_id": user["id"]},
                                   {"$set": update})
    return await db.addresses.find_one({"id": addr_id, "user_id": user["id"]},
                                        {"_id": 0})
