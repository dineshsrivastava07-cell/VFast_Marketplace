"""Customer-facing social features: wishlist + product reviews."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request

from ..models import new_id, now_iso
from ..security import require_roles, get_current_user
from ..services.audit import log_action

router = APIRouter(prefix="/api", tags=["social"])


# ============================================================
# Wishlist
# ============================================================
@router.get("/wishlist")
async def get_wishlist(request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    entries = await db.wishlists.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    if not entries:
        return {"items": []}
    ids = [e["product_id"] for e in entries]
    products = await db.products.find({"id": {"$in": ids}}, {"_id": 0}).to_list(500)
    p_map = {p["id"]: p for p in products}
    items = [{**p_map[e["product_id"]], "added_at": e["created_at"]}
             for e in entries if e["product_id"] in p_map]
    return {"items": items}


@router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    p = await db.products.find_one({"id": product_id}, {"_id": 0, "id": 1})
    if not p:
        raise HTTPException(404, "Product not found")
    await db.wishlists.update_one(
        {"user_id": user["id"], "product_id": product_id},
        {"$set": {"user_id": user["id"], "product_id": product_id, "created_at": now_iso()}},
        upsert=True,
    )
    return {"ok": True}


@router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, request: Request, user: dict = Depends(get_current_user)):
    db = request.state.db
    await db.wishlists.delete_one({"user_id": user["id"], "product_id": product_id})
    return {"ok": True}


# ============================================================
# Reviews
# ============================================================
@router.get("/products/{product_id}/reviews")
async def list_product_reviews(product_id: str, request: Request):
    """Public: list APPROVED reviews + aggregate rating."""
    db = request.state.db
    reviews = await db.reviews.find(
        {"product_id": product_id, "status": "approved"},
        {"_id": 0}).sort("created_at", -1).to_list(200)
    if not reviews:
        return {"reviews": [], "rating": 0, "count": 0}
    avg = round(sum(r["rating"] for r in reviews) / len(reviews), 1)
    return {"reviews": reviews, "rating": avg, "count": len(reviews)}


@router.post("/products/{product_id}/reviews")
async def submit_review(product_id: str, payload: dict, request: Request,
                         user: dict = Depends(get_current_user)):
    db = request.state.db
    p = await db.products.find_one({"id": product_id}, {"_id": 0, "id": 1, "name": 1})
    if not p:
        raise HTTPException(404, "Product not found")
    rating = int(payload.get("rating", 0))
    if not 1 <= rating <= 5:
        raise HTTPException(400, "Rating must be between 1 and 5")
    # Verify the customer has purchased it
    purchased = await db.orders.find_one(
        {"user_id": user["id"], "items.product_id": product_id,
         "status": {"$in": ["delivered", "out_for_delivery"]}},
        {"_id": 0, "order_no": 1},
    )
    doc = {
        "id": new_id(),
        "product_id": product_id,
        "product_name": p.get("name"),
        "user_id": user["id"],
        "author": user.get("name") or "VFast Customer",
        "rating": rating,
        "title": payload.get("title", "")[:120],
        "body": payload.get("body", "")[:2000],
        "verified_purchase": bool(purchased),
        "status": "pending",  # pending | approved | rejected
        "created_at": now_iso(),
    }
    await db.reviews.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc


# ============================================================
# Reviews — admin moderation
# ============================================================
admin_router = APIRouter(prefix="/api/admin/reviews", tags=["admin-reviews"])


@admin_router.get("/")
async def admin_list_reviews(request: Request, status: str = "pending",
                              _u=Depends(require_roles("super_admin", "admin", "operations"))):
    db = request.state.db
    q = {"status": status} if status else {}
    return await db.reviews.find(q, {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)


@admin_router.post("/{review_id}/moderate")
async def admin_moderate_review(review_id: str, payload: dict, request: Request,
                                 user=Depends(require_roles("super_admin", "admin"))):
    db = request.state.db
    new_status = payload.get("status")
    if new_status not in {"approved", "rejected"}:
        raise HTTPException(400, "Invalid status")
    r = await db.reviews.update_one(
        {"id": review_id},
        {"$set": {"status": new_status, "moderated_at": now_iso(),
                  "moderated_by": user.get("email")}},
    )
    if not r.matched_count:
        raise HTTPException(404, "Review not found")
    await log_action(db, user, f"review.{new_status}", "review", review_id)
    return {"ok": True}
