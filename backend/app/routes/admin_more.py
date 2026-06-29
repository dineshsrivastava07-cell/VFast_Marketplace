"""Phase-2 enterprise admin endpoints — dashboard, OMS extensions, catalog CRUD,
inventory, stores, zones, riders, RBAC, audit, settings, notification templates,
bulk CSV import.

All routes are mounted under /api/admin and protected via require_roles.
"""
from __future__ import annotations

import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile

from ..models import new_id, now_iso
from ..security import require_roles
from ..services.audit import log_action
from ..services.permissions import DEFAULT_PERMISSIONS, MODULES, ACTIONS

router = APIRouter(prefix="/api/admin", tags=["admin-phase2"])

# Shared role tuples
STAFF = ("super_admin", "admin", "operations")
ADMINS = ("super_admin", "admin")


# =========================================================
# 1. Dashboard — Live KPIs + ops board + charts
# =========================================================
@router.get("/dashboard/live")
async def dashboard_live(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)

    async def _count(filt):  # noqa
        return await db.orders.count_documents(filt)

    async def _gmv(start, end):
        pipeline = [
            {"$match": {"created_at": {"$gte": start.isoformat(), "$lt": end.isoformat()},
                        "status": {"$ne": "cancelled"}}},
            {"$group": {"_id": None, "g": {"$sum": "$total"}}},
        ]
        async for row in db.orders.aggregate(pipeline):
            return row.get("g", 0)
        return 0

    today_orders = await _count({"created_at": {"$gte": today_start.isoformat()}})
    today_gmv = await _gmv(today_start, now)
    yesterday_gmv = await _gmv(yesterday_start, today_start)
    pending_payments = await _count({"status": "payment_verifying"})
    active_riders = await db.users.count_documents({"role": "delivery_partner", "rider_status": "online"})
    low_stock = await db.products.count_documents({"$expr": {"$lte": ["$stock", "$reorder_level"]}})
    open_tickets = await db.support_tickets.count_documents({"status": {"$ne": "closed"}})

    # Status counts
    status_counts: dict[str, int] = {}
    for s in ["placed", "payment_pending", "payment_verifying", "packed",
              "out_for_delivery", "delivered", "cancelled", "payment_rejected"]:
        status_counts[s] = await _count({"status": s})

    # Hourly orders trend (last 24h)
    hourly: list[dict] = []
    for i in range(23, -1, -1):
        hs = now - timedelta(hours=i + 1)
        he = now - timedelta(hours=i)
        c = await _count({"created_at": {"$gte": hs.isoformat(), "$lt": he.isoformat()}})
        hourly.append({"hour": hs.strftime("%H:00"), "orders": c})

    # Category sales today
    category_sales = []
    pipeline = [
        {"$match": {"created_at": {"$gte": today_start.isoformat()}, "status": {"$ne": "cancelled"}}},
        {"$unwind": "$items"},
        {"$lookup": {"from": "products", "localField": "items.product_id", "foreignField": "id", "as": "p"}},
        {"$unwind": "$p"},
        {"$lookup": {"from": "categories", "localField": "p.category_id", "foreignField": "id", "as": "c"}},
        {"$unwind": "$c"},
        {"$group": {"_id": "$c.name", "revenue": {"$sum": "$items.line_total"}}},
        {"$sort": {"revenue": -1}},
    ]
    async for row in db.orders.aggregate(pipeline):
        category_sales.append({"category": row["_id"], "revenue": round(row["revenue"], 2)})

    return {
        "kpis": {
            "today_orders": today_orders,
            "today_gmv": round(today_gmv, 2),
            "yesterday_gmv": round(yesterday_gmv, 2),
            "active_riders": active_riders,
            "pending_payments": pending_payments,
            "low_stock_alerts": low_stock,
            "open_tickets": open_tickets,
        },
        "ops_board": status_counts,
        "hourly_orders": hourly,
        "category_sales": category_sales,
    }


# =========================================================
# 2. OMS extensions — bulk export, assign rider, status override, SLA
# =========================================================
@router.get("/oms/export")
async def export_orders_csv(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    orders = await db.orders.find({}, {"_id": 0}).sort("created_at", -1).limit(5000).to_list(5000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["order_no", "created_at", "customer_phone", "pincode", "items",
                     "subtotal", "delivery_fee", "total", "payment_method", "payment_status",
                     "status", "rider_id", "rider_name"])
    for o in orders:
        writer.writerow([o.get("order_no"), o.get("created_at"), o.get("customer_phone"),
                         o.get("address", {}).get("pincode"),
                         sum(i["qty"] for i in o.get("items", [])),
                         o.get("subtotal"), o.get("delivery_fee"), o.get("total"),
                         o.get("payment_method"), o.get("payment_status"),
                         o.get("status"), o.get("rider_id"), o.get("rider_name")])
    return {"csv": buf.getvalue(), "count": len(orders)}


@router.post("/oms/bulk")
async def oms_bulk(payload: dict, request: Request, user=Depends(require_roles(*STAFF))):
    db = request.state.db
    op = payload.get("action")
    order_nos = payload.get("order_nos", [])
    if op not in {"cancel", "assign_rider", "advance"}:
        raise HTTPException(400, "Unsupported action")
    if not isinstance(order_nos, list) or not order_nos:
        raise HTTPException(400, "order_nos required")
    affected = 0
    for no in order_nos:
        if op == "cancel":
            r = await db.orders.update_one({"order_no": no},
                {"$set": {"status": "cancelled"},
                 "$push": {"timeline": {"status": "cancelled", "at": now_iso(),
                                          "reason": payload.get("reason", "bulk cancel")}}})
            affected += r.modified_count
        elif op == "assign_rider":
            rider_id = payload.get("rider_id")
            rider = await db.users.find_one({"id": rider_id, "role": "delivery_partner"})
            if not rider:
                continue
            r = await db.orders.update_one({"order_no": no},
                {"$set": {"rider_id": rider["id"], "rider_name": rider.get("name")}})
            affected += r.modified_count
        elif op == "advance":
            new_status = payload.get("status")
            r = await db.orders.update_one({"order_no": no},
                {"$set": {"status": new_status},
                 "$push": {"timeline": {"status": new_status, "at": now_iso()}}})
            affected += r.modified_count
    await log_action(db, user, f"oms.bulk.{op}", "orders", None, {"count": affected, "order_nos": order_nos})
    return {"affected": affected}


@router.post("/orders/{order_no}/assign-rider")
async def assign_rider(order_no: str, payload: dict, request: Request,
                       user=Depends(require_roles(*STAFF))):
    db = request.state.db
    rider_id = payload.get("rider_id")
    rider = await db.users.find_one({"id": rider_id, "role": "delivery_partner"})
    if not rider:
        raise HTTPException(404, "Rider not found")
    r = await db.orders.update_one({"order_no": order_no},
        {"$set": {"rider_id": rider["id"], "rider_name": rider.get("name")},
         "$push": {"timeline": {"status": "rider_assigned", "at": now_iso(),
                                "rider_id": rider["id"]}}})
    if not r.matched_count:
        raise HTTPException(404, "Order not found")
    await log_action(db, user, "order.assign_rider", "order", order_no, {"rider_id": rider_id})
    return {"ok": True}


@router.post("/orders/{order_no}/override-status")
async def override_status(order_no: str, payload: dict, request: Request,
                          user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    new_status = payload.get("status")
    reason = payload.get("reason", "manual override")
    r = await db.orders.update_one({"order_no": order_no},
        {"$set": {"status": new_status},
         "$push": {"timeline": {"status": new_status, "at": now_iso(), "reason": reason,
                                "by": user.get("email")}}})
    if not r.matched_count:
        raise HTTPException(404, "Order not found")
    await log_action(db, user, "order.override_status", "order", order_no,
                     {"to": new_status, "reason": reason})
    return {"ok": True}


@router.get("/oms/sla")
async def sla_monitor(request: Request, _u=Depends(require_roles(*STAFF))):
    """Return list of orders with SLA color (green/amber/red)."""
    db = request.state.db
    now = datetime.now(timezone.utc)
    orders = await db.orders.find(
        {"status": {"$nin": ["delivered", "cancelled", "payment_rejected"]}},
        {"_id": 0}).to_list(500)
    out = []
    for o in orders:
        try:
            created = datetime.fromisoformat(o["created_at"].replace("Z", "+00:00"))
        except Exception:
            continue
        elapsed_min = (now - created).total_seconds() / 60
        eta = o.get("eta_minutes", 15)
        if elapsed_min <= eta:
            color = "green"
        elif elapsed_min <= eta * 1.5:
            color = "amber"
        else:
            color = "red"
        out.append({"order_no": o["order_no"], "status": o["status"], "elapsed_min": round(elapsed_min, 1),
                    "eta_minutes": eta, "color": color, "customer_phone": o.get("customer_phone"),
                    "total": o.get("total"), "rider_name": o.get("rider_name")})
    out.sort(key=lambda x: -x["elapsed_min"])
    return out


@router.get("/oms/exceptions")
async def exception_queue(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    statuses = ["payment_rejected", "cancelled"]
    orders = await db.orders.find({"status": {"$in": statuses}}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    # Tag stockout exceptions for client filtering
    stockouts = await db.orders.find({"exception": "stockout"}, {"_id": 0}).to_list(200)
    return orders + [{**s, "exception_type": "stockout"} for s in stockouts]


@router.get("/oms/cod-reconciliation")
async def cod_reconciliation(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    orders = await db.orders.find({"payment_method": "cod", "status": "delivered"},
                                  {"_id": 0}).sort("created_at", -1).limit(500).to_list(500)
    summary = {"collected": 0, "pending": 0, "amount_collected": 0.0, "amount_pending": 0.0}
    for o in orders:
        if o.get("payment_status") == "collected":
            summary["collected"] += 1
            summary["amount_collected"] += o.get("total", 0)
        else:
            summary["pending"] += 1
            summary["amount_pending"] += o.get("total", 0)
    return {"summary": summary, "orders": orders}


@router.post("/orders/{order_no}/mark-cash-collected")
async def mark_cash_collected(order_no: str, request: Request, user=Depends(require_roles(*STAFF))):
    db = request.state.db
    r = await db.orders.update_one({"order_no": order_no, "payment_method": "cod"},
        {"$set": {"payment_status": "collected", "collected_at": now_iso()}})
    if not r.matched_count:
        raise HTTPException(404, "Order not found or not COD")
    await log_action(db, user, "order.cod_collected", "order", order_no)
    return {"ok": True}


# =========================================================
# 3. Catalog CRUD (categories + products)
# =========================================================
@router.post("/catalog/categories")
async def create_category(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    slug = payload["slug"].strip()
    if await db.categories.find_one({"slug": slug}):
        raise HTTPException(400, "Slug already exists")
    parent_id = None
    if payload.get("parent_slug"):
        parent = await db.categories.find_one({"slug": payload["parent_slug"]})
        if not parent:
            raise HTTPException(400, "Parent not found")
        parent_id = parent["id"]
    doc = {
        "id": new_id(), "slug": slug, "name": payload["name"],
        "tint": payload.get("tint", "#F9FAFB"), "image": payload.get("image", ""),
        "parent_id": parent_id, "parent_slug": payload.get("parent_slug"),
        "sort_order": int(payload.get("sort_order", 100)), "created_at": now_iso(),
    }
    await db.categories.insert_one(doc.copy())
    await log_action(db, user, "category.create", "category", doc["id"], {"name": doc["name"]})
    doc.pop("_id", None)
    return doc


@router.patch("/catalog/categories/{cat_id}")
async def update_category(cat_id: str, payload: dict, request: Request,
                          user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    update = {k: v for k, v in payload.items() if k in {"name", "tint", "image", "sort_order"}}
    r = await db.categories.update_one({"id": cat_id}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "Category not found")
    await log_action(db, user, "category.update", "category", cat_id, update)
    return {"ok": True}


@router.delete("/catalog/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    cat = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not cat:
        raise HTTPException(404, "Category not found")
    slug = cat.get("slug")
    # Block if any products reference this category by id OR slug
    has_products = await db.products.count_documents({
        "$or": [
            {"category_id": cat_id}, {"subcategory_id": cat_id},
            {"category_slug": slug}, {"subcategory_slug": slug},
        ]
    })
    if has_products:
        raise HTTPException(400, "Category has products — move or delete them first")
    if await db.categories.count_documents({"parent_id": cat_id}):
        raise HTTPException(400, "Category has subcategories")
    await db.categories.delete_one({"id": cat_id})
    await log_action(db, user, "category.delete", "category", cat_id)
    return {"ok": True}


@router.post("/catalog/products")
async def create_product(payload: dict, request: Request,
                         user=Depends(require_roles("super_admin", "admin", "seller"))):
    db = request.state.db
    if await db.products.find_one({"slug": payload["slug"]}):
        raise HTTPException(400, "Slug already exists")
    cat = await db.categories.find_one({"slug": payload["category_slug"]})
    if not cat:
        raise HTTPException(400, "Category not found")
    sub = None
    if payload.get("subcategory_slug"):
        sub = await db.categories.find_one({"slug": payload["subcategory_slug"]})
    doc = {
        "id": new_id(), "slug": payload["slug"], "name": payload["name"],
        "brand": payload.get("brand", ""),
        "category_id": cat["id"], "subcategory_id": sub["id"] if sub else None,
        "image": payload.get("image", ""), "images": payload.get("images", []),
        "price": float(payload["price"]), "mrp": float(payload.get("mrp", payload["price"])),
        "pack_size": payload.get("pack_size", ""), "unit_value": payload.get("unit_value"),
        "unit": payload.get("unit"), "veg_type": payload.get("veg_type", "na"),
        "stock": int(payload.get("stock", 0)), "reorder_level": int(payload.get("reorder_level", 5)),
        "eta_minutes": int(payload.get("eta_minutes", 12)),
        "in_stock": int(payload.get("stock", 0)) > 0,
        "hsn_code": payload.get("hsn_code"), "fssai_no": payload.get("fssai_no"),
        "country_of_origin": payload.get("country_of_origin", "India"),
        "storage": payload.get("storage", "ambient"),
        "allergens": payload.get("allergens", []),
        "shelf_life_days": payload.get("shelf_life_days"),
        "nutrition_per_100": payload.get("nutrition_per_100"),
        "express_eligible": int(payload.get("eta_minutes", 12)) <= 15,
        "description": payload.get("description", ""),
        "seller_id": user["id"] if user["role"] == "seller" else payload.get("seller_id"),
        "created_at": now_iso(),
    }
    await db.products.insert_one(doc.copy())
    await log_action(db, user, "product.create", "product", doc["id"], {"name": doc["name"]})
    doc.pop("_id", None)
    return doc


@router.patch("/catalog/products/{prod_id}")
async def update_product(prod_id: str, payload: dict, request: Request,
                         user=Depends(require_roles("super_admin", "admin", "operations", "seller"))):
    db = request.state.db
    allowed = {"name", "brand", "image", "images", "price", "mrp", "pack_size", "unit_value",
               "unit", "veg_type", "stock", "reorder_level", "eta_minutes", "hsn_code",
               "fssai_no", "country_of_origin", "storage", "allergens", "shelf_life_days",
               "nutrition_per_100", "description"}
    update = {k: v for k, v in payload.items() if k in allowed}
    if "stock" in update:
        update["in_stock"] = update["stock"] > 0
    if "eta_minutes" in update:
        update["express_eligible"] = update["eta_minutes"] <= 15
    r = await db.products.update_one({"id": prod_id}, {"$set": update})
    if not r.matched_count:
        raise HTTPException(404, "Product not found")
    await log_action(db, user, "product.update", "product", prod_id, update)
    updated = await db.products.find_one({"id": prod_id}, {"_id": 0})
    return updated or {"ok": True}


@router.delete("/catalog/products/{prod_id}")
async def delete_product(prod_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    r = await db.products.delete_one({"id": prod_id})
    if not r.deleted_count:
        raise HTTPException(404, "Product not found")
    await log_action(db, user, "product.delete", "product", prod_id)
    return {"ok": True}


@router.post("/catalog/products/import-csv")
async def import_products_csv(request: Request, file: UploadFile = File(...),
                              user=Depends(require_roles(*ADMINS))):
    """CSV columns: slug,name,brand,category_slug,subcategory_slug,price,mrp,pack_size,unit_value,unit,veg_type,stock,reorder_level,eta_minutes,image,hsn_code,fssai_no"""
    db = request.state.db
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created, skipped, errors = 0, 0, []
    for i, row in enumerate(reader, start=2):
        try:
            if not row.get("slug"):
                continue
            if await db.products.find_one({"slug": row["slug"]}):
                skipped += 1
                continue
            cat = await db.categories.find_one({"slug": row["category_slug"]})
            if not cat:
                errors.append(f"row {i}: category {row['category_slug']} missing")
                continue
            sub = await db.categories.find_one({"slug": row["subcategory_slug"]}) if row.get("subcategory_slug") else None
            doc = {
                "id": new_id(), "slug": row["slug"], "name": row["name"],
                "brand": row.get("brand", ""),
                "category_id": cat["id"], "subcategory_id": sub["id"] if sub else None,
                "image": row.get("image", ""), "images": [row["image"]] if row.get("image") else [],
                "price": float(row["price"]), "mrp": float(row.get("mrp") or row["price"]),
                "pack_size": row.get("pack_size", ""),
                "unit_value": float(row["unit_value"]) if row.get("unit_value") else None,
                "unit": row.get("unit") or None,
                "veg_type": row.get("veg_type", "na"),
                "stock": int(row.get("stock") or 0),
                "reorder_level": int(row.get("reorder_level") or 5),
                "eta_minutes": int(row.get("eta_minutes") or 12),
                "in_stock": int(row.get("stock") or 0) > 0,
                "hsn_code": row.get("hsn_code"), "fssai_no": row.get("fssai_no"),
                "country_of_origin": row.get("country_of_origin", "India"),
                "express_eligible": int(row.get("eta_minutes") or 12) <= 15,
                "created_at": now_iso(),
            }
            await db.products.insert_one(doc)
            created += 1
        except Exception as e:
            errors.append(f"row {i}: {e}")
    await log_action(db, user, "products.import_csv", "products", None,
                     {"created": created, "skipped": skipped, "errors": errors[:10]})
    return {"created": created, "skipped": skipped, "errors": errors[:20]}


# =========================================================
# 4. Inventory — per-store stock, batches, low-stock
# =========================================================
@router.get("/inventory")
async def inventory_list(request: Request, store_id: Optional[str] = None,
                         _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    products = await db.products.find({}, {"_id": 0, "id": 1, "name": 1, "brand": 1,
                                            "stock": 1, "reorder_level": 1, "pack_size": 1,
                                            "image": 1, "price": 1}).to_list(2000)
    if store_id:
        store_stock = {s["product_id"]: s for s in
                       await db.store_inventory.find({"store_id": store_id}, {"_id": 0}).to_list(5000)}
        for p in products:
            ss = store_stock.get(p["id"])
            p["store_stock"] = ss.get("stock", 0) if ss else 0
            p["store_reorder"] = ss.get("reorder_level", 5) if ss else 5
    return products


@router.post("/inventory/{product_id}")
async def update_inventory(product_id: str, payload: dict, request: Request,
                           user=Depends(require_roles(*STAFF))):
    db = request.state.db
    update = {}
    if "stock" in payload:
        update["stock"] = int(payload["stock"])
        update["in_stock"] = update["stock"] > 0
    if "reorder_level" in payload:
        update["reorder_level"] = int(payload["reorder_level"])
    if update:
        await db.products.update_one({"id": product_id}, {"$set": update})
    if payload.get("store_id"):
        await db.store_inventory.update_one(
            {"store_id": payload["store_id"], "product_id": product_id},
            {"$set": {"store_id": payload["store_id"], "product_id": product_id,
                      "stock": int(payload.get("stock", 0)),
                      "reorder_level": int(payload.get("reorder_level", 5)),
                      "updated_at": now_iso()}},
            upsert=True,
        )
    await log_action(db, user, "inventory.update", "product", product_id, payload)
    updated = await db.products.find_one({"id": product_id}, {"_id": 0})
    return updated or {"ok": True}


@router.get("/inventory/low-stock")
async def low_stock(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    items = await db.products.find(
        {"$expr": {"$lte": ["$stock", "$reorder_level"]}},
        {"_id": 0, "id": 1, "name": 1, "brand": 1, "stock": 1, "reorder_level": 1, "image": 1, "pack_size": 1},
    ).to_list(500)
    return items


@router.post("/inventory/batches")
async def add_batch(payload: dict, request: Request, user=Depends(require_roles(*STAFF))):
    db = request.state.db
    doc = {
        "id": new_id(), "product_id": payload["product_id"],
        "batch_no": payload["batch_no"], "qty": int(payload["qty"]),
        "expiry_date": payload["expiry_date"],  # ISO yyyy-mm-dd
        "store_id": payload.get("store_id"),
        "received_at": now_iso(), "received_by": user.get("email"),
    }
    await db.batches.insert_one(doc.copy())
    # Increase stock on product
    await db.products.update_one({"id": doc["product_id"]},
                                 {"$inc": {"stock": doc["qty"]}, "$set": {"in_stock": True}})
    await log_action(db, user, "batch.create", "product", doc["product_id"], doc)
    doc.pop("_id", None)
    return doc


@router.get("/inventory/batches")
async def list_batches(request: Request, near_expiry_days: int = 7,
                       _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    batches = await db.batches.find({}, {"_id": 0}).sort("expiry_date", 1).to_list(1000)
    cutoff = (datetime.now(timezone.utc) + timedelta(days=near_expiry_days)).date().isoformat()
    near_expiry = [b for b in batches if b.get("expiry_date") and b["expiry_date"] <= cutoff]
    return {"batches": batches, "near_expiry": near_expiry, "cutoff": cutoff}


# =========================================================
# 5. Stores & Zones
# =========================================================
@router.get("/stores")
async def list_stores(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.dark_stores.find({}, {"_id": 0}).to_list(200)


@router.post("/stores")
async def upsert_store(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    doc = {
        "id": payload.get("id") or new_id(),
        "name": payload["name"], "address": payload.get("address", ""),
        "pincodes": payload.get("pincodes", []),
        "manager_email": payload.get("manager_email", ""),
        "operating_hours": payload.get("operating_hours", "10:00-22:00"),
        "active": payload.get("active", True),
        "updated_at": now_iso(),
    }
    await db.dark_stores.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await log_action(db, user, "store.upsert", "store", doc["id"], {"name": doc["name"]})
    return doc


@router.delete("/stores/{store_id}")
async def delete_store(store_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    await db.dark_stores.delete_one({"id": store_id})
    await log_action(db, user, "store.delete", "store", store_id)
    return {"ok": True}


@router.get("/zones")
async def list_zones(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.zones.find({}, {"_id": 0}).to_list(200)


@router.post("/zones")
async def upsert_zone(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    doc = {
        "id": payload.get("id") or new_id(),
        "name": payload["name"],
        "pincodes": payload.get("pincodes", []),
        "store_id": payload.get("store_id"),
        "active": payload.get("active", True),
        "updated_at": now_iso(),
    }
    await db.zones.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await log_action(db, user, "zone.upsert", "zone", doc["id"])
    return doc


@router.delete("/zones/{zone_id}")
async def delete_zone(zone_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    await db.zones.delete_one({"id": zone_id})
    await log_action(db, user, "zone.delete", "zone", zone_id)
    return {"ok": True}


# =========================================================
# 6. Riders
# =========================================================
@router.get("/riders")
async def list_riders(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    riders = await db.users.find({"role": "delivery_partner"}, {"_id": 0, "password_hash": 0}).to_list(500)
    # enrich with today's orders + earnings
    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    for r in riders:
        completed = await db.orders.count_documents({"rider_id": r["id"], "status": "delivered"})
        today_orders = await db.orders.count_documents({"rider_id": r["id"], "created_at": {"$gte": today}})
        r["completed_total"] = completed
        r["today_orders"] = today_orders
        r["earnings_today"] = round(today_orders * 25.0, 2)
        r["rider_status"] = r.get("rider_status", "offline")
        r["status"] = r["rider_status"]  # keep both for frontend compat
    return riders


@router.post("/riders")
async def upsert_rider(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    from ..security import hash_password
    email = payload["email"].lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        update = {k: payload[k] for k in ["name", "phone", "vehicle", "kyc", "rider_status"] if k in payload}
        await db.users.update_one({"id": existing["id"]}, {"$set": update})
        await log_action(db, user, "rider.update", "user", existing["id"])
        return {"ok": True, "id": existing["id"]}
    doc = {
        "id": new_id(), "email": email,
        "password_hash": hash_password(payload.get("password", "rider123")),
        "role": "delivery_partner",
        "name": payload.get("name", "Rider"), "phone": payload.get("phone", ""),
        "vehicle": payload.get("vehicle", "bike"),
        "kyc": payload.get("kyc", {"pan": "", "license": "", "verified": False}),
        "rider_status": payload.get("rider_status", "offline"),
        "created_at": now_iso(),
    }
    await db.users.insert_one(doc.copy())
    await log_action(db, user, "rider.create", "user", doc["id"], {"email": email})
    doc.pop("_id", None)
    doc.pop("password_hash", None)
    return doc


@router.post("/riders/{rider_id}/status")
async def set_rider_status(rider_id: str, payload: dict, request: Request,
                           user=Depends(require_roles(*STAFF))):
    db = request.state.db
    status = payload.get("status", "offline")
    if status not in {"online", "offline", "on_delivery"}:
        raise HTTPException(400, "Invalid status")
    await db.users.update_one({"id": rider_id, "role": "delivery_partner"},
                              {"$set": {"rider_status": status}})
    await log_action(db, user, "rider.set_status", "user", rider_id, {"status": status})
    return {"ok": True}


# =========================================================
# 7. PIN code extensions — bulk CSV + waitlist
# =========================================================
@router.post("/pincodes/import-csv")
async def import_pins_csv(request: Request, file: UploadFile = File(...),
                          user=Depends(require_roles(*ADMINS))):
    """CSV columns: pincode,city,delivery_fee,min_order_value,eta_minutes,active,zone_id,store_id"""
    db = request.state.db
    content = (await file.read()).decode("utf-8", errors="ignore")
    reader = csv.DictReader(io.StringIO(content))
    created, updated = 0, 0
    for row in reader:
        pin = (row.get("pincode") or "").strip()
        if len(pin) != 6 or not pin.isdigit():
            continue
        doc = {
            "pincode": pin,
            "city": row.get("city", ""),
            "delivery_fee": float(row.get("delivery_fee") or 20),
            "min_order_value": float(row.get("min_order_value") or 99),
            "eta_minutes": int(row.get("eta_minutes") or 12),
            "active": str(row.get("active", "true")).lower() in {"true", "1", "yes"},
            "zone_id": row.get("zone_id") or None,
            "store_id": row.get("store_id") or None,
            "updated_at": now_iso(),
        }
        existing = await db.serviceable_pincodes.find_one({"pincode": pin})
        if existing:
            await db.serviceable_pincodes.update_one({"pincode": pin}, {"$set": doc})
            updated += 1
        else:
            doc["id"] = new_id()
            doc["created_at"] = now_iso()
            await db.serviceable_pincodes.insert_one(doc)
            created += 1
    await log_action(db, user, "pincodes.import_csv", "pincodes", None,
                     {"created": created, "updated": updated})
    return {"created": created, "updated": updated}


@router.get("/pincodes/waitlist")
async def waitlist(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    return await db.pincode_waitlist.find({}, {"_id": 0}).sort("_id", -1).limit(500).to_list(500)


@router.get("/qr-codes/preview")
async def qr_preview(request: Request, pincode: str, _u=Depends(require_roles(*STAFF))):
    """Return the QR code that would be shown for a given PIN."""
    db = request.state.db
    qr = await db.qr_codes.find_one({"scope": "pincode", "pincode": pincode, "active": True}, {"_id": 0})
    if not qr:
        qr = await db.qr_codes.find_one({"scope": "global", "active": True}, {"_id": 0})
    return qr or {"missing": True}


# =========================================================
# 8. RBAC — role permissions + assignment
# =========================================================
@router.get("/rbac")
async def get_rbac(request: Request, _u=Depends(require_roles(*ADMINS))):
    db = request.state.db
    docs = await db.role_permissions.find({}, {"_id": 0}).to_list(50)
    if not docs:
        # seed defaults
        for role, perms in DEFAULT_PERMISSIONS.items():
            await db.role_permissions.insert_one({"role": role, "permissions": perms})
        docs = await db.role_permissions.find({}, {"_id": 0}).to_list(50)
    return {"modules": MODULES, "actions": ACTIONS, "roles": docs}


@router.post("/rbac/{role}")
async def set_rbac(role: str, payload: dict, request: Request, user=Depends(require_roles("super_admin"))):
    db = request.state.db
    perms = payload.get("permissions", {})
    if not isinstance(perms, dict):
        raise HTTPException(400, "permissions must be an object")
    await db.role_permissions.update_one({"role": role},
                                         {"$set": {"role": role, "permissions": perms}},
                                         upsert=True)
    await log_action(db, user, "rbac.update", "role", role, {"permissions": perms})
    return {"ok": True}


@router.post("/rbac/users/{user_id}/role")
async def set_user_role(user_id: str, payload: dict, request: Request,
                        user=Depends(require_roles("super_admin"))):
    db = request.state.db
    new_role = payload["role"]
    if new_role not in DEFAULT_PERMISSIONS:
        raise HTTPException(400, "Invalid role")
    r = await db.users.update_one({"id": user_id}, {"$set": {"role": new_role}})
    if not r.matched_count:
        raise HTTPException(404, "User not found")
    await log_action(db, user, "user.set_role", "user", user_id, {"role": new_role})
    return {"ok": True}


# =========================================================
# 9. Audit log
# =========================================================
@router.get("/audit")
async def list_audit(
    request: Request,
    user_email: Optional[str] = None,
    action: Optional[str] = None,
    target_type: Optional[str] = None,
    since: Optional[str] = None,
    limit: int = 200,
    _u=Depends(require_roles(*ADMINS)),
):
    db = request.state.db
    filt: dict = {}
    if user_email:
        filt["user_email"] = {"$regex": user_email, "$options": "i"}
    if action:
        filt["action"] = {"$regex": action, "$options": "i"}
    if target_type:
        filt["target_type"] = target_type
    if since:
        filt["at"] = {"$gte": since}
    return await db.audit_logs.find(filt, {"_id": 0}).sort("at", -1).limit(limit).to_list(limit)


@router.get("/audit/export")
async def export_audit_csv(request: Request, _u=Depends(require_roles(*ADMINS))):
    db = request.state.db
    rows = await db.audit_logs.find({}, {"_id": 0}).sort("at", -1).limit(10000).to_list(10000)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["at", "user_email", "user_role", "action", "target_type", "target_id", "details"])
    for r in rows:
        w.writerow([r.get("at"), r.get("user_email"), r.get("user_role"), r.get("action"),
                    r.get("target_type"), r.get("target_id"), str(r.get("details"))])
    return {"csv": buf.getvalue(), "count": len(rows)}


# =========================================================
# 10. Settings + Feature Flags + Notification Templates
# =========================================================
DEFAULT_SETTINGS = {
    "app_name": "VFast",
    "support_email": "support@vfast.local",
    "support_phone": "+91 1800-000-000",
    "dpo_email": "dpo@vmart.local",
    "dpo_phone": "+91 1800-000-001",
    "maintenance_mode": False,
}

DEFAULT_FLAGS = {
    "cod_enabled": True,
    "upi_qr_enabled": True,
    "referrals_enabled": False,
    "wallet_enabled": False,
    "hindi_toggle_enabled": True,
    "dpdp_consent_banner": True,
}


@router.get("/settings")
async def get_settings(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    s = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not s:
        s = {"id": "global", "settings": DEFAULT_SETTINGS, "flags": DEFAULT_FLAGS}
        await db.settings.insert_one(s.copy())
    s.setdefault("settings", DEFAULT_SETTINGS)
    s.setdefault("flags", DEFAULT_FLAGS)
    return s


@router.post("/settings")
async def update_settings(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    update = {}
    if "settings" in payload:
        update["settings"] = {**DEFAULT_SETTINGS, **payload["settings"]}
    if "flags" in payload:
        update["flags"] = {**DEFAULT_FLAGS, **payload["flags"]}
    await db.settings.update_one({"id": "global"}, {"$set": {"id": "global", **update}}, upsert=True)
    await log_action(db, user, "settings.update", "settings", "global", update)
    return {"ok": True}


@router.get("/notification-templates")
async def list_templates(request: Request, _u=Depends(require_roles(*STAFF))):
    db = request.state.db
    items = await db.notification_templates.find({}, {"_id": 0}).to_list(200)
    if not items:
        defaults = [
            {"id": new_id(), "channel": "sms", "event": "order_placed",
             "body": "Your VFast order {order_no} for ₹{total} is placed. ETA {eta} min.", "active": True},
            {"id": new_id(), "channel": "sms", "event": "out_for_delivery",
             "body": "Your VFast order {order_no} is out for delivery.", "active": True},
            {"id": new_id(), "channel": "email", "event": "order_delivered",
             "subject": "Your VFast order has been delivered",
             "body": "Thanks for shopping at VFast! Order {order_no} delivered. Total ₹{total}.", "active": True},
            {"id": new_id(), "channel": "push", "event": "payment_rejected",
             "body": "Your UPI payment for {order_no} could not be verified. Please retry.", "active": True},
        ]
        await db.notification_templates.insert_many([d.copy() for d in defaults])
        items = await db.notification_templates.find({}, {"_id": 0}).to_list(200)
    return items


@router.post("/notification-templates")
async def upsert_template(payload: dict, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    # Accept 'event' or legacy 'code' for the trigger key
    event = payload.get("event") or payload.get("code")
    channel = payload.get("channel")
    body = payload.get("body")
    if not event or not channel or not body:
        raise HTTPException(400, "channel, event and body are required")
    doc = {
        "id": payload.get("id") or new_id(),
        "channel": channel,
        "event": event,
        "subject": payload.get("subject", ""),
        "body": body,
        "active": payload.get("active", True),
        "updated_at": now_iso(),
    }
    await db.notification_templates.update_one({"id": doc["id"]}, {"$set": doc}, upsert=True)
    await log_action(db, user, "template.upsert", "template", doc["id"])
    return doc


@router.delete("/notification-templates/{tpl_id}")
async def delete_template(tpl_id: str, request: Request, user=Depends(require_roles(*ADMINS))):
    db = request.state.db
    await db.notification_templates.delete_one({"id": tpl_id})
    await log_action(db, user, "template.delete", "template", tpl_id)
    return {"ok": True}
