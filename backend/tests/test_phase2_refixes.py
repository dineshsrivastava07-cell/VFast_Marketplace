"""VFast Phase-2 re-validation tests for iteration_2 fixes.

Targeted to verify ONLY the fixes called out in the review request:
FIX 1  - Staff login still works (EmailStr->str retained)
FIX 3  - DELETE category blocked when slug-based products exist (food-beverages)
FIX 4  - GET /admin/oms/exceptions returns plain ARRAY
FIX 5  - GET /admin/riders rows have BOTH rider_status and status
FIX 6  - PATCH product returns UPDATED doc with recomputed express_eligible
FIX 6b - POST inventory returns updated doc with recomputed in_stock (true/false)
FIX 7  - POST notification-templates: missing event -> 400 (NOT 500); 'code' alias -> 200
"""
import os
import uuid
import pytest
import requests

BASE = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE}/api"

S = requests.Session()
STATE = {}


def _h(t):
    return {"Authorization": f"Bearer {t}"}


# ------------------ Auth bootstrap ------------------ #
def test_fix1_staff_login_all_roles():
    for key, email, pw, expected_role in [
        ("admin", "admin@vfast.local", "admin123", "admin"),
        ("super", "super.admin@vfast.local", "admin123", "super_admin"),
        ("ops", "ops@vfast.local", "ops123", ("ops", "operations")),
    ]:
        r = S.post(f"{API}/auth/login", json={"email": email, "password": pw}, timeout=15)
        assert r.status_code == 200, f"{key} login failed {r.status_code}: {r.text}"
        body = r.json()
        assert "token" in body and body["token"]
        STATE[f"{key}_token"] = body["token"]
        role = body["user"]["role"]
        if isinstance(expected_role, tuple):
            assert role in expected_role, f"{key} role={role}"
        else:
            assert role == expected_role, f"{key} role={role}"


# ------------------ FIX 3: DELETE category slug-based block ------------------ #
def test_fix3_delete_category_blocked_when_slug_products_exist():
    # Fetch food-beverages category id first
    rc = S.get(f"{API}/catalog/categories", timeout=15)
    assert rc.status_code == 200, rc.text
    cats = rc.json()
    fb = next((c for c in cats if c.get("slug") == "food-beverages"), None)
    assert fb is not None, "food-beverages category not found in catalog"
    cat_id = fb.get("id")
    assert cat_id, f"missing id field on category: {fb}"

    r = S.delete(f"{API}/admin/catalog/categories/{cat_id}",
                 headers=_h(STATE["admin_token"]), timeout=15)
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"
    detail = (r.json() or {}).get("detail") or (r.json() or {}).get("message") or ""
    assert "product" in detail.lower(), f"expected 'has products' style message, got: {detail}"


# ------------------ FIX 4: OMS exceptions is plain array ------------------ #
def test_fix4_oms_exceptions_returns_array():
    r = S.get(f"{API}/admin/oms/exceptions", headers=_h(STATE["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert isinstance(j, list), f"expected list, got {type(j).__name__}: {j}"
    # If list non-empty validate shape
    for it in j[:5]:
        assert "order_no" in it, f"missing order_no in: {it}"
        assert "status" in it, f"missing status in: {it}"
        # stockout-tagged entries (if any) carry exception_type='stockout'
        if it.get("exception_type"):
            assert it["exception_type"] in ("stockout", "payment_rejected", "cancelled", "rejected"), \
                f"unexpected exception_type: {it['exception_type']}"


# ------------------ FIX 5: riders both rider_status & status ------------------ #
def test_fix5_riders_have_both_rider_status_and_status():
    r = S.get(f"{API}/admin/riders", headers=_h(STATE["admin_token"]), timeout=15)
    assert r.status_code == 200, r.text
    rows = r.json()
    assert isinstance(rows, list) and len(rows) >= 1, "no riders seeded"
    for row in rows:
        assert "rider_status" in row, f"missing rider_status: keys={list(row.keys())}"
        assert "status" in row, f"missing status alias: keys={list(row.keys())}"
        # canonical and alias must match
        assert row["rider_status"] == row["status"], \
            f"rider_status({row['rider_status']}) != status({row['status']})"


# ------------------ FIX 6: PATCH product returns updated doc ------------------ #
@pytest.fixture(scope="module")
def make_test_product():
    slug = f"test-prod-{uuid.uuid4().hex[:6]}"
    payload = {
        "slug": slug, "name": "Refix Test Product", "brand": "Brand",
        "category_slug": "food-beverages", "subcategory_slug": "dairy-eggs",
        "price": 99, "mrp": 120,
        "pack_size": "500ml", "unit_value": 500, "unit": "ml",
        "veg_type": "veg", "stock": 10, "reorder_level": 3,
        "eta_minutes": 12, "image": "/static/test.png",
    }
    # need admin token - module fixture depends on test_fix1 running first
    if "admin_token" not in STATE:
        r0 = S.post(f"{API}/auth/login",
                    json={"email": "admin@vfast.local", "password": "admin123"}, timeout=15)
        STATE["admin_token"] = r0.json()["token"]
    r = S.post(f"{API}/admin/catalog/products", json=payload,
               headers=_h(STATE["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), r.text
    j = r.json()
    pid = j.get("id") or j.get("_id") or slug
    return pid


def test_fix6_patch_product_returns_updated_with_express_eligible_true():
    pid = make_test_product.__wrapped__() if hasattr(make_test_product, "__wrapped__") else None
    # easier: just create inline here for clean test
    slug = f"test-prod-{uuid.uuid4().hex[:6]}"
    payload = {
        "slug": slug, "name": "Express Test Product", "brand": "Brand",
        "category_slug": "food-beverages", "subcategory_slug": "dairy-eggs",
        "price": 99, "mrp": 120, "pack_size": "500ml", "unit_value": 500, "unit": "ml",
        "veg_type": "veg", "stock": 10, "reorder_level": 3,
        "eta_minutes": 20, "image": "/static/test.png",
    }
    rc = S.post(f"{API}/admin/catalog/products", json=payload,
                headers=_h(STATE["admin_token"]), timeout=15)
    assert rc.status_code in (200, 201), rc.text
    pid = (rc.json() or {}).get("id") or (rc.json() or {}).get("_id") or slug
    STATE["fix6_pid"] = pid

    # PATCH eta=10 -> express True
    r1 = S.patch(f"{API}/admin/catalog/products/{pid}",
                 json={"eta_minutes": 10},
                 headers=_h(STATE["admin_token"]), timeout=15)
    assert r1.status_code in (200, 201), r1.text
    body1 = r1.json()
    # Must be the updated document, NOT {"ok": true}
    assert isinstance(body1, dict) and body1.get("ok") is not True or "express_eligible" in body1, \
        f"PATCH returned bare ok-only response: {body1}"
    assert body1.get("express_eligible") is True, \
        f"eta=10 should make express_eligible True, got: {body1.get('express_eligible')} | body={body1}"
    assert body1.get("eta_minutes") == 10


def test_fix6_patch_product_returns_updated_with_express_eligible_false():
    pid = STATE.get("fix6_pid")
    assert pid, "previous test should have created product"
    r2 = S.patch(f"{API}/admin/catalog/products/{pid}",
                 json={"eta_minutes": 30},
                 headers=_h(STATE["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    body2 = r2.json()
    assert body2.get("express_eligible") is False, \
        f"eta=30 should make express_eligible False, got: {body2.get('express_eligible')} | body={body2}"
    assert body2.get("eta_minutes") == 30


# ------------------ FIX 6b: POST inventory returns updated in_stock ------------------ #
def test_fix6b_inventory_update_returns_in_stock_false_then_true():
    pid = STATE.get("fix6_pid")
    assert pid

    # stock=0 -> in_stock False
    r1 = S.post(f"{API}/admin/inventory/{pid}",
                json={"stock": 0, "reorder_level": 5},
                headers=_h(STATE["admin_token"]), timeout=15)
    assert r1.status_code in (200, 201), r1.text
    b1 = r1.json()
    assert b1.get("in_stock") is False, f"stock=0 -> in_stock should be False; body={b1}"
    assert b1.get("stock") == 0

    # stock=5 -> in_stock True
    r2 = S.post(f"{API}/admin/inventory/{pid}",
                json={"stock": 5, "reorder_level": 3},
                headers=_h(STATE["admin_token"]), timeout=15)
    assert r2.status_code in (200, 201), r2.text
    b2 = r2.json()
    assert b2.get("in_stock") is True, f"stock=5 -> in_stock should be True; body={b2}"
    assert b2.get("stock") == 5


# ------------------ FIX 7: notification-templates validation ------------------ #
def test_fix7_template_missing_event_returns_400_not_500():
    r = S.post(f"{API}/admin/notification-templates",
               json={"channel": "sms", "body": "hi"},
               headers=_h(STATE["admin_token"]), timeout=15)
    assert r.status_code == 400, f"expected 400 got {r.status_code}: {r.text}"


def test_fix7_template_legacy_code_alias_accepted():
    payload = {"channel": "sms", "code": f"order_placed_{uuid.uuid4().hex[:5]}",
               "body": "hi {order_no}"}
    r = S.post(f"{API}/admin/notification-templates", json=payload,
               headers=_h(STATE["admin_token"]), timeout=15)
    assert r.status_code in (200, 201), f"code alias rejected: {r.status_code}: {r.text}"
    body = r.json() or {}
    # The created template should have event populated from code
    assert body.get("event") == payload["code"] or body.get("code") == payload["code"], \
        f"event not set from code alias: {body}"
    # cleanup
    tid = body.get("id")
    if tid:
        S.delete(f"{API}/admin/notification-templates/{tid}",
                 headers=_h(STATE["admin_token"]), timeout=15)
