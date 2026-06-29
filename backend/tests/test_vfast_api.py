"""VFast backend regression tests (Phase 1).

Covers: health, catalog (categories/products/brands/PDP), serviceability,
auth (OTP + email/password + /me), cart preview, orders (COD + UPI flows),
admin (dashboard/orders/RBAC/pincodes/QR/upload).
"""
import io
import os
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://vmart-express.preview.emergentagent.com"
API = f"{BASE}/api"

# Shared state across tests within module
STATE = {}


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------------- Health ---------------- #
def test_health(s):
    r = s.get(f"{API}/health", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("status") == "ok"
    assert j.get("db") == "up"


# ---------------- Catalog: categories ---------------- #
def test_categories_top_level(s):
    r = s.get(f"{API}/catalog/categories", timeout=15)
    assert r.status_code == 200
    cats = r.json()
    names = {c["name"] for c in cats}
    expected = {
        "Food & Beverages",
        "Staples & Cooking Essentials",
        "Personal Care",
        "Home Care & Cleaning",
        "Health & Wellness",
        "Household & General Merchandise",
    }
    assert expected.issubset(names), f"Missing categories. Got: {names}"
    assert len(cats) == 6, f"Expected 6 top categories, got {len(cats)}"


def test_categories_subcategories_food(s):
    r = s.get(f"{API}/catalog/categories", params={"parent": "food-beverages"}, timeout=15)
    assert r.status_code == 200
    subs = r.json()
    slugs = {c.get("slug") for c in subs}
    assert len(subs) == 12, f"Expected 12 subcategories, got {len(subs)}"
    for need in ("fruits-veg", "dairy-eggs", "ready-to-cook"):
        assert need in slugs, f"Missing subcategory slug: {need}"


# ---------------- Catalog: products ---------------- #
def test_products_list(s):
    r = s.get(f"{API}/catalog/products", params={"limit": 200}, timeout=20)
    assert r.status_code == 200
    products = r.json()
    assert len(products) >= 40, f"Expected >=40 products, got {len(products)}"
    p = products[0]
    for field in ("brand", "pack_size", "unit", "veg_type", "discount_percent", "in_stock", "low_stock"):
        assert field in p, f"Missing field {field} in product {p.get('slug')}"


def test_products_filter_veg_and_brand(s):
    r = s.get(f"{API}/catalog/products", params={"category": "staples", "veg": "veg"}, timeout=15)
    assert r.status_code == 200
    for p in r.json():
        assert p["veg_type"] in ("veg", "vegan"), f"Non-veg leaked: {p['slug']} ({p['veg_type']})"
    r2 = s.get(f"{API}/catalog/products", params={"brand": "Amul"}, timeout=15)
    assert r2.status_code == 200
    items = r2.json()
    assert len(items) >= 1
    for p in items:
        assert p["brand"] == "Amul"


def test_brands_food(s):
    r = s.get(f"{API}/catalog/brands", params={"category": "food-beverages"}, timeout=15)
    assert r.status_code == 200
    brands = r.json()
    assert isinstance(brands, list) and len(brands) > 0
    assert brands == sorted(brands, key=lambda x: str(x).lower()) or brands == sorted(brands)


def test_product_detail_amul(s):
    r = s.get(f"{API}/catalog/products/amul-taaza-milk-1l", timeout=15)
    assert r.status_code == 200, r.text
    p = r.json()
    assert p.get("brand") == "Amul"
    assert p.get("nutrition_per_100") is not None
    assert p.get("fssai") or p.get("fssai_no")
    assert p.get("hsn") or p.get("hsn_code")
    storage = (p.get("storage") or "").lower()
    assert "refriger" in storage, f"storage={storage!r}"


# ---------------- Serviceability ---------------- #
def test_serviceability_ok(s):
    r = s.get(f"{API}/serviceability/check/110001", timeout=15)
    assert r.status_code == 200
    j = r.json()
    assert j.get("serviceable") is True
    assert "eta_minutes" in j and "delivery_fee" in j


def test_serviceability_invalid_format(s):
    r = s.get(f"{API}/serviceability/check/999999", timeout=15)
    # spec: invalid (non-allowlist + maybe range). 999999 starts with 9 which can be invalid
    # The spec says: 999999 returns 400. Accept 400 strictly.
    assert r.status_code == 400, f"Got {r.status_code}: {r.text}"


def test_serviceability_not_serviceable(s):
    r = s.get(f"{API}/serviceability/check/560001", timeout=15)
    assert r.status_code == 200
    assert r.json().get("serviceable") is False


# ---------------- Auth: OTP customer ---------------- #
def test_otp_request_india(s):
    r = s.post(f"{API}/auth/otp/request", json={"phone": "+919999999999"}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "dev_code" in j, f"Missing dev_code. Got: {j}"
    STATE["dev_code"] = j["dev_code"]


def test_otp_request_non_india_rejected(s):
    r = s.post(f"{API}/auth/otp/request", json={"phone": "+155512345"}, timeout=15)
    assert r.status_code == 400


def test_otp_verify_and_me(s):
    assert "dev_code" in STATE
    r = s.post(f"{API}/auth/otp/verify", json={"phone": "+919999999999", "code": STATE["dev_code"]}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "token" in j and "user" in j
    assert j["user"]["role"] == "customer"
    STATE["cust_token"] = j["token"]
    STATE["cust_user"] = j["user"]
    me = s.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {j['token']}"}, timeout=15)
    assert me.status_code == 200
    mu = me.json()
    assert mu.get("phone") == "+919999999999"


# ---------------- Auth: email/password admin ---------------- #
def test_admin_login_ok(s):
    r = s.post(f"{API}/auth/login", json={"email": "admin@vfast.local", "password": "admin123"}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["user"]["role"] == "admin"
    STATE["admin_token"] = j["token"]


def test_admin_login_bad_password(s):
    r = s.post(f"{API}/auth/login", json={"email": "admin@vfast.local", "password": "WRONG"}, timeout=15)
    assert r.status_code == 401


# ---------------- Cart preview ---------------- #
def _get_two_product_ids(s):
    if "two_products" in STATE:
        return STATE["two_products"]
    r = s.get(f"{API}/catalog/products", params={"limit": 50}, timeout=15)
    assert r.status_code == 200
    ps = [p for p in r.json() if p.get("in_stock", True)][:2]
    assert len(ps) == 2
    out = [(p.get("id") or p.get("_id") or p.get("slug"), p) for p in ps]
    STATE["two_products"] = out
    return out


def test_cart_preview(s):
    items = _get_two_product_ids(s)
    payload = {
        "items": [{"product_id": pid, "qty": 2} for pid, _ in items],
        "pincode": "110001",
    }
    r = s.post(f"{API}/cart/preview", json=payload, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    for k in ("subtotal", "delivery_fee", "free_delivery_threshold", "eta_minutes"):
        assert k in j, f"Missing key {k}: {j}"
    assert j["free_delivery_threshold"] == 199


# ---------------- Orders: COD ---------------- #
def _auth_h(tok):
    return {"Authorization": f"Bearer {tok}"}


def test_order_cod_flow(s):
    items = _get_two_product_ids(s)
    payload_items = [{"product_id": pid, "qty": 1} for pid, _ in items]
    # set cart
    r0 = s.post(f"{API}/cart/set", json={"items": payload_items, "pincode": "110001"},
                headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r0.status_code in (200, 201), r0.text

    order_payload = {
        "items": payload_items,
        "pincode": "110001",
        "payment_method": "cod",
        "address": {"flat": "A-1", "area": "CP", "city": "Delhi", "state": "DL", "pincode": "110001", "phone": "+919999999999"},
    }
    r = s.post(f"{API}/orders/", json=order_payload, headers=_auth_h(STATE["cust_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    o = r.json()
    assert o.get("status") == "placed"
    assert str(o.get("order_no", "")).startswith("VF")
    STATE["cod_order_no"] = o["order_no"]

    r2 = s.get(f"{API}/orders/{o['order_no']}", headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r2.status_code == 200 and r2.json()["order_no"] == o["order_no"]

    r3 = s.post(f"{API}/orders/{o['order_no']}/cancel", headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r3.status_code in (200, 201), r3.text
    r4 = s.get(f"{API}/orders/{o['order_no']}", headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r4.json()["status"] == "cancelled"


# ---------------- Orders: UPI QR ---------------- #
def test_order_upi_flow(s):
    items = _get_two_product_ids(s)
    payload_items = [{"product_id": pid, "qty": 1} for pid, _ in items]
    # re-set cart (prior COD order may have cleared it)
    s.post(f"{API}/cart/set", json={"items": payload_items, "pincode": "110001"},
           headers=_auth_h(STATE["cust_token"]), timeout=15)
    order_payload = {
        "items": payload_items,
        "pincode": "110001",
        "payment_method": "upi_qr",
        "address": {"flat": "A-2", "area": "CP", "city": "Delhi", "state": "DL", "pincode": "110001", "phone": "+919999999999"},
    }
    r = s.post(f"{API}/orders/", json=order_payload, headers=_auth_h(STATE["cust_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    o = r.json()
    assert o.get("status") == "payment_pending"
    qr = o.get("qr_code") or {}
    assert qr.get("upi_id") and qr.get("image_url"), f"Missing QR: {qr}"
    STATE["upi_order_no"] = o["order_no"]

    proof = {"utr": "TEST123456", "proof_image_url": "/api/static/uploads/test.png"}
    r2 = s.post(f"{API}/orders/{o['order_no']}/upi-proof", json=proof,
                headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    r3 = s.get(f"{API}/orders/{o['order_no']}", headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r3.json()["status"] == "payment_verifying"


# ---------------- Admin ---------------- #
def test_admin_dashboard(s):
    if "admin_token" not in STATE:
        pytest.skip("admin_token missing (admin login broken)")
    r = s.get(f"{API}/admin/dashboard", headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert "recent_orders" in j


def test_admin_orders_payment_verifying(s):
    if "admin_token" not in STATE:
        pytest.skip("admin_token missing")
    r = s.get(f"{API}/admin/orders", params={"status": "payment_verifying"},
              headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r.status_code == 200
    j = r.json()
    rows = j if isinstance(j, list) else j.get("items") or j.get("orders") or []
    assert any(o.get("order_no") == STATE.get("upi_order_no") for o in rows), \
        f"UPI order not in payment_verifying list. rows={len(rows)}"


def test_admin_verify_payment_and_advance(s):
    if "admin_token" not in STATE or "upi_order_no" not in STATE:
        pytest.skip("Prereq missing")
    no = STATE["upi_order_no"]
    r = s.post(f"{API}/admin/orders/{no}/verify-payment", json={"status": "verified"},
               headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    r2 = s.get(f"{API}/orders/{no}", headers=_auth_h(STATE["cust_token"]), timeout=15)
    body = r2.json()
    assert body.get("status") == "packed", f"Expected packed, got {body.get('status')}"
    assert body.get("payment_status") == "verified"

    r3 = s.post(f"{API}/admin/orders/{no}/advance", json={"status": "out_for_delivery"},
                headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r3.status_code in (200, 201), r3.text


def test_admin_rbac_customer_forbidden(s):
    r = s.get(f"{API}/admin/dashboard", headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r.status_code == 403


# ---------------- Admin Pincodes ---------------- #
def test_admin_pincode_crud(s):
    if "admin_token" not in STATE:
        pytest.skip("admin_token missing")
    payload = {"pincode": "110010", "city": "Test", "fee": 25, "min_order": 99, "eta_minutes": 15, "active": True}
    r = s.post(f"{API}/admin/pincodes", json=payload, headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text

    r2 = s.get(f"{API}/admin/pincodes", headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r2.status_code == 200
    rows = r2.json() if isinstance(r2.json(), list) else r2.json().get("items", [])
    assert any(p.get("pincode") == "110010" for p in rows)

    # non-admin cannot delete
    r3 = s.delete(f"{API}/admin/pincodes/110010", headers=_auth_h(STATE["cust_token"]), timeout=15)
    assert r3.status_code in (401, 403)

    r4 = s.delete(f"{API}/admin/pincodes/110010", headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r4.status_code in (200, 204)


# ---------------- Admin QR upload ---------------- #
def test_admin_qr_upload_and_crud(s):
    if "admin_token" not in STATE:
        pytest.skip("admin_token missing")
    # 1x1 PNG bytes
    png = bytes.fromhex(
        "89504E470D0A1A0A0000000D49484452000000010000000108060000001F15C4890000000A49444154789C6300010000000500010D0A2DB40000000049454E44AE426082"
    )
    files = {"file": ("qr.png", io.BytesIO(png), "image/png")}
    r = s.post(f"{API}/payments/upload", files=files,
               headers=_auth_h(STATE["admin_token"]), timeout=20)
    assert r.status_code in (200, 201), r.text
    j = r.json()
    assert j.get("url") and j.get("filename")
    url = j["url"]

    r2 = s.post(f"{API}/admin/qr-codes",
                json={"upi_id": "vmart@hdfc", "image_url": url, "label": "Test QR", "is_active": True, "scope": "global"},
                headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    qr_id = (r2.json() or {}).get("id") or (r2.json() or {}).get("_id")

    r3 = s.get(f"{API}/admin/qr-codes", headers=_auth_h(STATE["admin_token"]), timeout=15)
    assert r3.status_code == 200
    rows = r3.json() if isinstance(r3.json(), list) else r3.json().get("items", [])
    assert len(rows) >= 1
    # try to recover id
    if not qr_id:
        for row in rows:
            if row.get("image_url") == url:
                qr_id = row.get("id") or row.get("_id")
                break

    if qr_id:
        r4 = s.delete(f"{API}/admin/qr-codes/{qr_id}", headers=_auth_h(STATE["admin_token"]), timeout=15)
        assert r4.status_code in (200, 204)
