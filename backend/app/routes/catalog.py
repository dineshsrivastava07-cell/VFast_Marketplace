"""Catalog: categories (with subcategories), products, search, filters, buy-again."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from ..security import get_optional_user

router = APIRouter(prefix="/api/catalog", tags=["catalog"])


def _product_out(p: dict) -> dict:
    p.pop("_id", None)
    if p.get("mrp", 0) > 0 and p["price"] < p["mrp"]:
        p["discount_percent"] = int(round((1 - p["price"] / p["mrp"]) * 100))
    else:
        p["discount_percent"] = 0
    # per-unit price for clarity (e.g. "₹2/pc", "₹0.15/g")
    unit = p.get("unit")
    val = p.get("unit_value") or 0
    if unit and val and val > 0:
        if unit in {"g", "ml"}:
            # Show per 100 unit for small items
            p["per_unit_price"] = round(p["price"] / val * 100, 2)
            p["per_unit_label"] = f"₹{p['per_unit_price']}/100{unit}"
        elif unit in {"kg", "L"}:
            p["per_unit_price"] = round(p["price"] / val, 2)
            p["per_unit_label"] = f"₹{p['per_unit_price']}/{unit}"
        elif unit == "pc" and val > 1:
            p["per_unit_price"] = round(p["price"] / val, 2)
            p["per_unit_label"] = f"₹{p['per_unit_price']}/pc"
        else:
            p["per_unit_price"] = None
            p["per_unit_label"] = None
    else:
        p["per_unit_label"] = None
    p["low_stock"] = 0 < p.get("stock", 0) <= 5
    return p


@router.get("/categories")
async def list_categories(
    request: Request,
    parent: Optional[str] = Query(default=None, description="parent slug; omit for top-level"),
):
    """Return top categories (default) or subcategories of a given parent slug."""
    db = request.state.db
    if parent:
        parent_doc = await db.categories.find_one({"slug": parent}, {"_id": 0, "id": 1})
        if not parent_doc:
            return []
        cursor = db.categories.find({"parent_id": parent_doc["id"]}, {"_id": 0}).sort("sort_order", 1)
    else:
        cursor = db.categories.find({"parent_id": None}, {"_id": 0}).sort("sort_order", 1)
    return await cursor.to_list(500)


@router.get("/categories/{slug}")
async def category_detail(slug: str, request: Request):
    db = request.state.db
    c = await db.categories.find_one({"slug": slug}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Category not found")
    subs = []
    if c.get("parent_id") is None:
        subs = await db.categories.find({"parent_id": c["id"]}, {"_id": 0}).sort("sort_order", 1).to_list(200)
    return {**c, "subcategories": subs}


@router.get("/products")
async def list_products(
    request: Request,
    category: Optional[str] = Query(default=None, description="category or subcategory slug"),
    q: Optional[str] = Query(default=None),
    brand: Optional[str] = Query(default=None),
    veg: Optional[str] = Query(default=None, description="veg|nonveg|vegan"),
    min_price: Optional[float] = Query(default=None),
    max_price: Optional[float] = Query(default=None),
    min_discount: Optional[int] = Query(default=None),
    in_stock: Optional[bool] = Query(default=None),
    sort: Optional[str] = Query(default=None, description="price_asc|price_desc|discount|newest"),
    limit: int = Query(default=60, le=200),
):
    db = request.state.db
    filt: dict = {}
    if category:
        # treat as top or sub: match products whose category_id OR subcategory_id matches the cat's id
        cat = await db.categories.find_one({"slug": category}, {"_id": 0, "id": 1, "parent_id": 1})
        if not cat:
            return []
        if cat.get("parent_id") is None:
            filt["category_id"] = cat["id"]
        else:
            filt["subcategory_id"] = cat["id"]
    if q:
        filt["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
        ]
    if brand:
        filt["brand"] = {"$regex": f"^{brand}$", "$options": "i"}
    if veg:
        filt["veg_type"] = veg
    if min_price is not None or max_price is not None:
        pf: dict = {}
        if min_price is not None:
            pf["$gte"] = min_price
        if max_price is not None:
            pf["$lte"] = max_price
        filt["price"] = pf
    if in_stock:
        filt["stock"] = {"$gt": 0}

    cursor = db.products.find(filt, {"_id": 0})
    if sort == "price_asc":
        cursor = cursor.sort("price", 1)
    elif sort == "price_desc":
        cursor = cursor.sort("price", -1)
    elif sort == "newest":
        cursor = cursor.sort("created_at", -1)
    items = await cursor.limit(limit).to_list(limit)
    items = [_product_out(p) for p in items]
    if min_discount is not None:
        items = [p for p in items if p["discount_percent"] >= min_discount]
    if sort == "discount":
        items.sort(key=lambda p: p["discount_percent"], reverse=True)
    return items


@router.get("/products/{slug}")
async def product_detail(slug: str, request: Request):
    db = request.state.db
    p = await db.products.find_one({"slug": slug}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return _product_out(p)


@router.get("/banners")
async def banners(request: Request):
    db = request.state.db
    return await db.banners.find({}, {"_id": 0}).to_list(20)


@router.get("/brands")
async def list_brands(request: Request, category: Optional[str] = None):
    """Return distinct brand list — optionally scoped to a category."""
    db = request.state.db
    match: dict = {}
    if category:
        cat = await db.categories.find_one({"slug": category}, {"_id": 0, "id": 1, "parent_id": 1})
        if cat:
            if cat.get("parent_id") is None:
                match["category_id"] = cat["id"]
            else:
                match["subcategory_id"] = cat["id"]
    brands = await db.products.distinct("brand", match)
    return sorted([b for b in brands if b])


@router.get("/buy-again")
async def buy_again(request: Request, user=Depends(get_optional_user)):
    """Recently purchased FMCG items for the logged-in customer."""
    if not user:
        return []
    db = request.state.db
    seen: dict[str, dict] = {}
    cursor = db.orders.find({"user_id": user["id"]}, {"_id": 0, "items": 1}).sort("created_at", -1).limit(20)
    async for o in cursor:
        for it in o.get("items", []):
            if it["product_id"] not in seen:
                seen[it["product_id"]] = it
            if len(seen) >= 10:
                break
        if len(seen) >= 10:
            break
    if not seen:
        return []
    products = await db.products.find({"id": {"$in": list(seen.keys())}}, {"_id": 0}).to_list(20)
    return [_product_out(p) for p in products]
