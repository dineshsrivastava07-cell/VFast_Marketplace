"""VFast Phase-2 admin panel regression tests.

Covers dashboard/live, OMS (SLA/exceptions/COD/bulk/override/assign-rider),
catalog CRUD + CSV import, inventory + batches, stores/zones, riders,
pincodes CSV + waitlist, QR preview, RBAC, audit, settings, templates,
and RBAC guards.
"""
import csv
import io
import os
import time
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://vmart-express.preview.emergentagent.com").rstrip("/")
API = f"{BASE}/api"

S = requests.Session()
ST = {}


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ---------------- Auth bootstrap ---------------- #
def test_login_admin_super_ops_rider():
    for key, email, pw in [
        ("admin", "admin@vfast.local", "admin123"),
        ("super", "super.admin@vfast.local", "admin123"),
        ("ops", "ops@vfast.local", "ops123"),
        ("rider", "rider@vfast.local", "rider123"),
    ]:
        r = S.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
        assert r.status_code == 200, f"{key} login {r.status_code}: {r.text}"
        ST[f"{key}_token"] = r.json()["token"]
        ST[f"{key}_user"] = r.json()["user"]
    assert ST["admin_user"]["role"] == "admin"
    assert ST["super_user"]["role"] == "super_admin"
    assert ST["ops_user"]["role"] in ("ops", "operations")
    assert ST["rider_user"]["role"] == "delivery_partner"


def test_customer_otp_and_seed_orders():
    """Create a couple of orders so OMS SLA/override has data."""
    r = S.post(f"{API}/auth/otp/request", json={"phone": "+919999999999"}, timeout=15)
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r2 = S.post(f"{API}/auth/otp/verify", json={"phone": "+919999999999", "code": code}, timeout=15)
    assert r2.status_code == 200
    ST["cust_token"] = r2.json()["token"]
    # fetch 2 products
    ps = S.get(f"{API}/catalog/products", params={"limit": 30}, timeout=15).json()
    ps = [p for p in ps if p.get("in_stock", True)][:2]
    assert len(ps) == 2
    items = [{"product_id": p.get("id") or p.get("slug"), "qty": 1} for p in ps]
    ST["items"] = items
    addr = {"flat": "T-1", "area": "CP", "city": "Delhi", "state": "DL",
            "pincode": "110001", "phone": "+919999999999"}
    for _ in range(2):
        S.post(f"{API}/cart/set", json={"items": items, "pincode": "110001"},
               headers=_h(ST["cust_token"]), timeout=15)
        r3 = S.post(f"{API}/orders/", json={"items": items, "pincode": "110001",
                                             "payment_method": "cod", "address": addr},
                    headers=_h(ST["cust_token"]), timeout=20)
        assert r3.status_code in (200, 201), r3.text
        ST.setdefault("orders", []).append(r3.json()["order_no"])


# ---------------- Dashboard live ---------------- #
def test_dashboard_live():
    r = S.get(f"{API}/admin/dashboard/live", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ("kpis", "ops_board", "hourly_orders", "category_sales"):
        assert k in j, f"missing key {k}"
    for kk in ("today_orders", "today_gmv", "yesterday_gmv", "active_riders",
               "pending_payments", "low_stock_alerts", "open_tickets"):
        assert kk in j["kpis"], f"missing kpi {kk}"
    for st in ("placed", "payment_verifying", "packed", "out_for_delivery", "delivered", "cancelled"):
        assert st in j["ops_board"], f"missing ops status {st}"
    assert isinstance(j["hourly_orders"], list) and len(j["hourly_orders"]) == 24
    assert "hour" in j["hourly_orders"][0] and "orders" in j["hourly_orders"][0]
    assert isinstance(j["category_sales"], list)


# ---------------- OMS ---------------- #
def test_oms_sla_exceptions_cod():
    r = S.get(f"{API}/admin/oms/sla", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list)
    for o in rows[:5]:
        assert o.get("color") in ("green", "amber", "red"), f"bad color: {o.get('color')}"
    r2 = S.get(f"{API}/admin/oms/exceptions", headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code == 200 and isinstance(r2.json(), list)
    r3 = S.get(f"{API}/admin/oms/cod-reconciliation", headers=_h(ST["admin_token"]), timeout=15)
    assert r3.status_code == 200
    j = r3.json()
    assert "summary" in j and "orders" in j
    for k in ("collected", "pending"):
        assert k in j["summary"]


def test_oms_export_and_bulk_cancel():
    r = S.get(f"{API}/admin/oms/export", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "csv" in j and "count" in j
    # bulk cancel last order
    order_no = ST["orders"][-1]
    r2 = S.post(f"{API}/admin/oms/bulk",
                json={"action": "cancel", "order_nos": [order_no]},
                headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    # verify
    r3 = S.get(f"{API}/orders/{order_no}", headers=_h(ST["cust_token"]), timeout=15)
    assert r3.json().get("status") == "cancelled"


def test_oms_override_status_and_assign_rider():
    order_no = ST["orders"][0]
    # override
    r = S.post(f"{API}/admin/orders/{order_no}/override-status",
               json={"status": "packed", "reason": "manual override test"},
               headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    body = S.get(f"{API}/orders/{order_no}", headers=_h(ST["cust_token"]), timeout=15).json()
    assert body.get("status") == "packed"
    timeline = body.get("timeline") or []
    assert any(t.get("status") == "packed" for t in timeline)

    # assign-rider invalid -> 404
    r2 = S.post(f"{API}/admin/orders/{order_no}/assign-rider",
                json={"rider_id": "nonexistent-rider-id"},
                headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code == 404, f"expected 404 got {r2.status_code}: {r2.text}"

    # assign real rider
    rider_id = ST["rider_user"]["id"]
    r3 = S.post(f"{API}/admin/orders/{order_no}/assign-rider",
                json={"rider_id": rider_id},
                headers=_h(ST["admin_token"]), timeout=15)
    assert r3.status_code in (200, 201), r3.text


def test_oms_mark_cash_collected_cod_only():
    # create a fresh COD order and try mark-cash-collected
    addr = {"flat": "T-2", "area": "CP", "city": "Delhi", "state": "DL",
            "pincode": "110001", "phone": "+919999999999"}
    S.post(f"{API}/cart/set", json={"items": ST["items"], "pincode": "110001"},
           headers=_h(ST["cust_token"]), timeout=15)
    r = S.post(f"{API}/orders/", json={"items": ST["items"], "pincode": "110001",
                                       "payment_method": "cod", "address": addr},
               headers=_h(ST["cust_token"]), timeout=20)
    no = r.json()["order_no"]
    r2 = S.post(f"{API}/admin/orders/{no}/mark-cash-collected",
                headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    body = S.get(f"{API}/orders/{no}", headers=_h(ST["cust_token"]), timeout=15).json()
    assert body.get("payment_status") == "collected"


# ---------------- Catalog CRUD ---------------- #
def test_catalog_category_crud():
    slug = f"test-cat-{uuid.uuid4().hex[:6]}"
    r = S.post(f"{API}/admin/catalog/categories",
               json={"slug": slug, "name": "Test Cat", "tint": "#abc"},
               headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    cid = (r.json() or {}).get("id") or slug
    ST["cat_slug"] = slug
    ST["cat_id"] = cid
    # PATCH
    r2 = S.patch(f"{API}/admin/catalog/categories/{cid}",
                 json={"name": "Test Cat Updated", "tint": "#fff"},
                 headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text


def test_catalog_product_crud_and_express_recompute():
    slug = f"test-prod-{uuid.uuid4().hex[:6]}"
    payload = {
        "slug": slug, "name": "Test Product", "brand": "TestBrand",
        "category_slug": "food-beverages",
        "subcategory_slug": "dairy-eggs",
        "price": 99, "mrp": 120,
        "pack_size": "500ml", "unit_value": 500, "unit": "ml",
        "veg_type": "veg", "stock": 10, "reorder_level": 3,
        "eta_minutes": 12, "image": "/static/test.png",
    }
    r = S.post(f"{API}/admin/catalog/products", json=payload,
               headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    j = r.json() or {}
    pid = j.get("id") or j.get("_id") or slug
    ST["prod_id"] = pid
    ST["prod_slug"] = slug
    # verify FMCG attrs
    for fld, val in (("brand", "TestBrand"), ("pack_size", "500ml"), ("unit", "ml"), ("veg_type", "veg")):
        assert j.get(fld) == val, f"missing/mismatch {fld}: {j.get(fld)}"
    # eta_minutes <= 15 -> express_eligible True
    assert j.get("express_eligible") is True

    # PATCH eta to 30 -> express False
    r2 = S.patch(f"{API}/admin/catalog/products/{pid}",
                 json={"eta_minutes": 30, "price": 89},
                 headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    assert (r2.json() or {}).get("express_eligible") is False


def test_catalog_csv_import():
    slug_new = f"csv-new-{uuid.uuid4().hex[:6]}"
    csvbuf = io.StringIO()
    w = csv.writer(csvbuf)
    w.writerow(["slug", "name", "brand", "category_slug", "subcategory_slug", "price", "mrp",
                "pack_size", "unit_value", "unit", "veg_type", "stock", "reorder_level",
                "eta_minutes", "image"])
    w.writerow([slug_new, "CSV New", "BrandX", "food-beverages", "dairy-eggs",
                "50", "60", "100g", "100", "g", "veg", "20", "5", "12", "/s.png"])
    # duplicate of existing seed product (should skip)
    w.writerow(["amul-taaza-milk-1l", "Amul (dup)", "Amul", "food-beverages", "dairy-eggs",
                "60", "70", "1l", "1", "l", "veg", "5", "2", "12", "/x.png"])
    files = {"file": ("p.csv", csvbuf.getvalue(), "text/csv")}
    r = S.post(f"{API}/admin/catalog/products/import-csv", files=files,
               headers=_h(ST["admin_token"]), timeout=30)
    assert r.status_code in (200, 201), r.text
    j = r.json()
    assert j.get("created", 0) >= 1
    assert j.get("skipped", 0) >= 1
    assert "errors" in j


def test_catalog_category_delete_blocks_if_products():
    # the catg we created is empty -> deletable
    r = S.delete(f"{API}/admin/catalog/categories/{ST['cat_id']}",
                 headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code in (200, 204), r.text
    # try deleting food-beverages -> should block
    r2 = S.delete(f"{API}/admin/catalog/categories/food-beverages",
                  headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (400, 409), f"expected 4xx got {r2.status_code}"


# ---------------- Inventory ---------------- #
def test_inventory_list_low_update_batches():
    r = S.get(f"{API}/admin/inventory", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list) and len(items) > 0
    p = items[0]
    assert "stock" in p and "reorder_level" in p

    pid = ST["prod_id"]
    r2 = S.post(f"{API}/admin/inventory/{pid}",
                json={"stock": 0, "reorder_level": 5},
                headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    # in_stock recomputed False
    assert (r2.json() or {}).get("in_stock") is False

    rl = S.get(f"{API}/admin/inventory/low-stock", headers=_h(ST["admin_token"]), timeout=15)
    assert rl.status_code == 200
    for it in rl.json():
        assert it["stock"] <= it["reorder_level"]

    # batch add
    rb = S.post(f"{API}/admin/inventory/batches",
                json={"product_id": pid, "batch_no": "B-TEST-1", "qty": 25,
                      "expiry": "2026-12-31"},
                headers=_h(ST["admin_token"]), timeout=15)
    assert rb.status_code in (200, 201), rb.text

    # verify stock incremented (was 0 -> +25 -> 25)
    inv = S.get(f"{API}/admin/inventory", headers=_h(ST["admin_token"]), timeout=15).json()
    me = next((x for x in inv if (x.get("id") or x.get("_id") or x.get("slug")) == pid
               or x.get("slug") == ST["prod_slug"]), None)
    assert me is not None and me["stock"] >= 25, f"stock not incremented: {me}"

    rg = S.get(f"{API}/admin/inventory/batches", headers=_h(ST["admin_token"]), timeout=15)
    assert rg.status_code == 200
    j = rg.json()
    for k in ("batches", "near_expiry", "cutoff"):
        assert k in j


# ---------------- Stores / Zones ---------------- #
def test_stores_zones_crud():
    r = S.get(f"{API}/admin/stores", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200 and isinstance(r.json(), list)
    r2 = S.get(f"{API}/admin/zones", headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code == 200 and isinstance(r2.json(), list)

    payload = {"name": f"TEST_Store_{uuid.uuid4().hex[:4]}",
               "pincodes": ["110001"], "manager_email": "mgr@vfast.in",
               "operating_hours": "9-21", "active": True}
    rc = S.post(f"{API}/admin/stores", json=payload,
                headers=_h(ST["admin_token"]), timeout=15)
    assert rc.status_code in (200, 201), rc.text
    sid = (rc.json() or {}).get("id")
    assert sid

    rz = S.post(f"{API}/admin/zones",
                json={"name": f"TEST_Zone_{uuid.uuid4().hex[:4]}",
                      "store_id": sid, "pincodes": ["110001"]},
                headers=_h(ST["admin_token"]), timeout=15)
    assert rz.status_code in (200, 201), rz.text
    zid = (rz.json() or {}).get("id")

    if zid:
        rd = S.delete(f"{API}/admin/zones/{zid}", headers=_h(ST["admin_token"]), timeout=15)
        assert rd.status_code in (200, 204)
    rd2 = S.delete(f"{API}/admin/stores/{sid}", headers=_h(ST["admin_token"]), timeout=15)
    assert rd2.status_code in (200, 204)


# ---------------- Riders ---------------- #
def test_riders_list_create_status():
    r = S.get(f"{API}/admin/riders", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    riders = r.json()
    assert isinstance(riders, list) and len(riders) >= 1
    sample = riders[0]
    for f in ("rider_status", "today_orders", "earnings_today", "completed_total"):
        assert f in sample, f"missing rider field {f}"

    email = f"test_rider_{uuid.uuid4().hex[:6]}@vfast.in"
    rc = S.post(f"{API}/admin/riders",
                json={"name": "Test Rider", "email": email, "password": "rider123",
                      "phone": "+919888777666"},
                headers=_h(ST["admin_token"]), timeout=15)
    assert rc.status_code in (200, 201), rc.text
    new_rider = rc.json()
    assert new_rider.get("role") == "delivery_partner"
    rid = new_rider.get("id")

    for st_val in ("online", "on_delivery", "offline"):
        rs = S.post(f"{API}/admin/riders/{rid}/status",
                    json={"status": st_val},
                    headers=_h(ST["admin_token"]), timeout=15)
        assert rs.status_code in (200, 201), f"{st_val}: {rs.text}"

    rs2 = S.post(f"{API}/admin/riders/{rid}/status",
                 json={"status": "invalid_status"},
                 headers=_h(ST["admin_token"]), timeout=15)
    assert rs2.status_code in (400, 422), f"bad status accepted: {rs2.status_code}"


# ---------------- Pincodes CSV + waitlist + QR ---------------- #
def test_pincodes_csv_import_and_waitlist():
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["pincode", "city", "delivery_fee", "min_order_value", "eta_minutes",
                "active", "zone_id", "store_id"])
    w.writerow(["110055", "Delhi", "20", "99", "15", "true", "", ""])
    files = {"file": ("p.csv", buf.getvalue(), "text/csv")}
    r = S.post(f"{API}/admin/pincodes/import-csv", files=files,
               headers=_h(ST["admin_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text

    rw = S.get(f"{API}/admin/pincodes/waitlist", headers=_h(ST["admin_token"]), timeout=15)
    assert rw.status_code == 200 and isinstance(rw.json(), list)


def test_qr_preview():
    r = S.get(f"{API}/admin/qr-codes/preview", params={"pincode": "110001"},
              headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code in (200, 404), f"got {r.status_code}: {r.text}"
    if r.status_code == 200:
        j = r.json()
        assert j.get("upi_id") or j.get("image_url"), f"empty preview: {j}"


# ---------------- RBAC ---------------- #
def test_rbac_get_and_update():
    r = S.get(f"{API}/admin/rbac", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ("modules", "actions", "roles"):
        assert k in j
    assert isinstance(j["roles"], list) and len(j["roles"]) >= 1

    # admin (non super) update -> 403
    r2 = S.post(f"{API}/admin/rbac/admin", json={"permissions": {}},
                headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code == 403, f"non-super updated rbac: {r2.status_code}"

    # super_admin update should work
    sample_perms = {j["modules"][0]: {a: True for a in j["actions"][:1]}}
    r3 = S.post(f"{API}/admin/rbac/admin", json={"permissions": sample_perms},
                headers=_h(ST["super_token"]), timeout=15)
    assert r3.status_code in (200, 201), r3.text


# ---------------- Audit ---------------- #
def test_audit_list_filter_export():
    r = S.get(f"{API}/admin/audit", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    rows = r.json() if isinstance(r.json(), list) else r.json().get("items", [])
    assert len(rows) >= 1
    e = rows[0]
    for f in ("user_email", "action", "target_type"):
        assert f in e

    r2 = S.get(f"{API}/admin/audit",
               params={"user_email": "admin@vfast.local"},
               headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code == 200

    r3 = S.get(f"{API}/admin/audit/export", headers=_h(ST["admin_token"]), timeout=15)
    assert r3.status_code == 200
    j = r3.json()
    assert "csv" in j and "count" in j


# ---------------- Settings + flags ---------------- #
def test_settings_get_update_persist():
    r = S.get(f"{API}/admin/settings", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert "settings" in j and "flags" in j

    upd = {"settings": {"app_name": "VFast Test"},
           "flags": {"cod_enabled": False}}
    r2 = S.post(f"{API}/admin/settings", json=upd,
                headers=_h(ST["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text

    r3 = S.get(f"{API}/admin/settings", headers=_h(ST["admin_token"]), timeout=15)
    j3 = r3.json()
    assert j3["settings"].get("app_name") == "VFast Test"
    assert j3["flags"].get("cod_enabled") is False

    # restore
    S.post(f"{API}/admin/settings",
           json={"settings": {"app_name": "VFast"}, "flags": {"cod_enabled": True}},
           headers=_h(ST["admin_token"]), timeout=15)


# ---------------- Notification templates ---------------- #
def test_templates_list_create_delete():
    r = S.get(f"{API}/admin/notification-templates", headers=_h(ST["admin_token"]), timeout=15)
    assert r.status_code == 200
    rows = r.json()
    assert len(rows) >= 4, f"expected >=4 seeded templates, got {len(rows)}"

    rc = S.post(f"{API}/admin/notification-templates",
                json={"channel": "sms", "event": f"TEST_{uuid.uuid4().hex[:5]}",
                      "subject": "Hi", "body": "Hello {{name}}", "active": True},
                headers=_h(ST["admin_token"]), timeout=15)
    assert rc.status_code in (200, 201), rc.text
    tid = (rc.json() or {}).get("id")
    if tid:
        rd = S.delete(f"{API}/admin/notification-templates/{tid}",
                      headers=_h(ST["admin_token"]), timeout=15)
        assert rd.status_code in (200, 204)


# ---------------- RBAC guards ---------------- #
def test_rbac_customer_forbidden():
    for ep in ("/admin/dashboard/live", "/admin/audit", "/admin/settings"):
        r = S.get(f"{API}{ep}", headers=_h(ST["cust_token"]), timeout=15)
        assert r.status_code == 403, f"{ep} expected 403 got {r.status_code}"


def test_rbac_ops_can_read_sla_but_not_override():
    r = S.get(f"{API}/admin/oms/sla", headers=_h(ST["ops_token"]), timeout=15)
    assert r.status_code == 200, f"ops cannot read sla: {r.status_code}"

    if ST.get("orders"):
        no = ST["orders"][0]
        r2 = S.post(f"{API}/admin/orders/{no}/override-status",
                    json={"status": "delivered", "reason": "x"},
                    headers=_h(ST["ops_token"]), timeout=15)
        assert r2.status_code == 403, f"ops override allowed: {r2.status_code}"
