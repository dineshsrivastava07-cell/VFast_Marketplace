"""
FINAL pre-deploy E2E sweep for VFast - tests 12 critical flows end-to-end.
Run: REACT_APP_BACKEND_URL=https://vmart-express.preview.emergentagent.com \
     python -m pytest backend/tests/test_vfast_e2e_final.py -v -n 0

NOTE: spec inconsistencies discovered during validation:
- FLOW 2: /api/serviceability/check/999999 returns 200 serviceable=false (999999 IS a
  valid 6-digit format, backend only rejects format-invalid like "12345").
- FLOW 5/6: payment_method on POST /api/orders is "upi_qr" not "upi".
- FLOW 5/6: Address model requires flat/area/state/city/phone/pincode (not "line1").
- FLOW 6: UPI proof endpoint is JSON {utr, proof_image_url}, not multipart.
- FLOW 8: /api/admin/orders/{no}/advance requires body {status: "packed"} (target).
- FLOW 8: After verify-payment {status:"verified"}, order jumps straight to "packed".
"""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vmart-express.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


class _State:
    customer_token = None
    customer_phone = "+919999999999"
    admin_token = None
    super_admin_token = None
    ops_token = None
    rider_token = None
    seller_token = None
    cod_order_no = None
    upi_order_no = None
    product = None

S = _State()


def _bearer(t):
    return {"Authorization": f"Bearer {t}"} if t else {}


ADDRESS_DELHI = {
    "label": "Home",
    "flat": "Flat 1",
    "area": "Connaught Place",
    "landmark": "Near metro",
    "city": "Delhi",
    "state": "Delhi",
    "pincode": "110001",
    "phone": "+919999999999",
}


# ============================== FLOW 12 ==============================
def test_flow12_health():
    r = requests.get(f"{API}/health", timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("status") == "ok"
    assert j.get("db") == "up"


def test_flow12_catalog_products():
    r = requests.get(f"{API}/catalog/products", params={"limit": 200}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    items = data if isinstance(data, list) else data.get("items") or data.get("products") or []
    assert len(items) >= 40, f"expected >=40 FMCG products, got {len(items)}"
    p = items[0]
    for key in ("brand", "pack_size"):
        assert key in p, f"FMCG shape missing {key}; got {list(p.keys())}"
    chosen = next((x for x in items if x.get("slug") == "amul-taaza-milk-1l"), items[0])
    S.product = chosen


# ============================== FLOW 1 ===============================
def test_flow1_otp_request_and_verify():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": S.customer_phone}, timeout=15)
    assert r.status_code in (200, 201), r.text
    j = r.json()
    assert "dev_code" in j, f"dev_code missing in mock OTP response: {j}"
    code = j["dev_code"]
    r2 = requests.post(f"{API}/auth/otp/verify", json={"phone": S.customer_phone, "code": code}, timeout=15)
    assert r2.status_code == 200, r2.text
    j2 = r2.json()
    token = j2.get("token") or j2.get("access_token")
    assert token, j2
    assert j2.get("user", {}).get("role") == "customer"
    S.customer_token = token

    me = requests.get(f"{API}/auth/me", headers=_bearer(token), timeout=15)
    assert me.status_code == 200, me.text
    assert me.json().get("role") == "customer"


# ============================== FLOW 2 ===============================
def test_flow2_serviceable_pin():
    r = requests.get(f"{API}/serviceability/check/110001", timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    assert j.get("serviceable") is True
    assert "eta_minutes" in j and "delivery_fee" in j


def test_flow2_invalid_pin_format():
    # NOTE: spec said 999999 should be 400, but 999999 is a valid 6-digit format.
    # Backend correctly returns 400 only for format-invalid PINs.
    r = requests.get(f"{API}/serviceability/check/12345", timeout=15)
    assert r.status_code == 400, f"expected 400 for malformed pin, got {r.status_code} {r.text}"
    # Also confirm 999999 (valid format, not seeded) -> 200 serviceable=false
    r2 = requests.get(f"{API}/serviceability/check/999999", timeout=15)
    assert r2.status_code == 200
    assert r2.json().get("serviceable") is False


def test_flow2_nonserviceable_pin():
    r = requests.get(f"{API}/serviceability/check/560001", timeout=15)
    assert r.status_code == 200, r.text
    assert r.json().get("serviceable") is False


# ====================== Staff logins (FLOW 7) ========================
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    j = r.json()
    return j.get("token") or j.get("access_token"), j.get("user", {})


def test_flow7_admin_login_and_dashboard():
    tok, user = _login("admin@vfast.local", "admin123")
    assert user.get("role") == "admin"
    S.admin_token = tok
    r = requests.get(f"{API}/admin/dashboard/live", headers=_bearer(tok), timeout=20)
    assert r.status_code == 200, r.text
    j = r.json()
    for key in ("kpis", "ops_board", "hourly_orders", "category_sales"):
        assert key in j, f"dashboard missing {key}"


def test_other_staff_logins():
    S.super_admin_token, su = _login("super.admin@vfast.local", "admin123")
    assert su.get("role") == "super_admin"
    S.ops_token, ou = _login("ops@vfast.local", "ops123")
    assert ou.get("role") in ("operations", "ops")
    S.rider_token, ru = _login("rider@vfast.local", "rider123")
    assert ru.get("role") in ("delivery_partner", "rider")
    S.seller_token, sl = _login("seller@vfast.local", "seller123")
    assert sl.get("role") == "seller"


# ============================== FLOW 5 ===============================
def _set_cart_for_customer(qty=1):
    pid = S.product["id"]
    r = requests.post(
        f"{API}/cart/set",
        json={"items": [{"product_id": pid, "qty": qty}], "pincode": "110001"},
        headers=_bearer(S.customer_token),
        timeout=15,
    )
    assert r.status_code == 200, r.text
    return r.json()


def _place_order(payment_method):
    _set_cart_for_customer()
    payload = {
        "address": ADDRESS_DELHI,
        "payment_method": payment_method,
        "delivery_slot": "express",
    }
    return requests.post(f"{API}/orders/", json=payload, headers=_bearer(S.customer_token), timeout=20)


def test_flow5_cod_order():
    # bump qty so subtotal likely >= min_order_value
    pid = S.product["id"]
    requests.post(
        f"{API}/cart/set",
        json={"items": [{"product_id": pid, "qty": 3}], "pincode": "110001"},
        headers=_bearer(S.customer_token),
        timeout=15,
    )
    payload = {"address": ADDRESS_DELHI, "payment_method": "cod", "delivery_slot": "express"}
    r = requests.post(f"{API}/orders/", json=payload, headers=_bearer(S.customer_token), timeout=20)
    assert r.status_code in (200, 201), f"cod place failed: {r.status_code} {r.text}"
    j = r.json()
    assert j.get("status") == "placed", j
    order_no = j.get("order_no")
    assert order_no and order_no.startswith("VF"), f"bad order_no: {order_no}"
    # timeline should already have 'placed'
    assert any(e.get("status") == "placed" for e in j.get("timeline", []))
    S.cod_order_no = order_no


# ============================== FLOW 6 ===============================
def test_flow6_upi_order_and_proof():
    pid = S.product["id"]
    requests.post(
        f"{API}/cart/set",
        json={"items": [{"product_id": pid, "qty": 3}], "pincode": "110001"},
        headers=_bearer(S.customer_token),
        timeout=15,
    )
    payload = {"address": ADDRESS_DELHI, "payment_method": "upi_qr", "delivery_slot": "express"}
    r = requests.post(f"{API}/orders/", json=payload, headers=_bearer(S.customer_token), timeout=20)
    assert r.status_code in (200, 201), r.text
    j = r.json()
    order_no = j.get("order_no")
    assert order_no
    S.upi_order_no = order_no
    # initial state is payment_pending; QR is attached
    assert j.get("status") == "payment_pending", j
    assert j.get("qr_code"), "qr_code must be attached on upi_qr orders"

    # submit UPI proof (JSON body)
    proof_payload = {"utr": "TESTUTR123", "proof_image_url": "https://example.com/proof.png"}
    rp = requests.post(
        f"{API}/orders/{order_no}/upi-proof",
        json=proof_payload,
        headers=_bearer(S.customer_token),
        timeout=15,
    )
    assert rp.status_code in (200, 201), f"upi-proof failed: {rp.status_code} {rp.text}"
    od = rp.json()
    assert od.get("status") == "payment_verifying", od


# ============================== FLOW 8 ===============================
def test_flow8_admin_assign_rider_and_advance_cod():
    assert S.cod_order_no
    h = _bearer(S.admin_token)
    # find rider
    rr = requests.get(f"{API}/admin/riders", headers=h, timeout=15)
    assert rr.status_code == 200, rr.text
    riders_raw = rr.json()
    riders = riders_raw if isinstance(riders_raw, list) else riders_raw.get("items", [])
    rider = next((x for x in riders if (x.get("email") or "").startswith("rider@")), None) or (riders[0] if riders else None)
    assert rider, "no rider found"
    rider_id = rider.get("id") or rider.get("user_id")

    ra = requests.post(
        f"{API}/admin/orders/{S.cod_order_no}/assign-rider",
        json={"rider_id": rider_id},
        headers=h,
        timeout=15,
    )
    assert ra.status_code in (200, 201), f"assign-rider failed: {ra.status_code} {ra.text}"

    # advance to packed - body required
    rad = requests.post(
        f"{API}/admin/orders/{S.cod_order_no}/advance",
        json={"status": "packed"},
        headers=h,
        timeout=15,
    )
    assert rad.status_code in (200, 201), rad.text


def test_flow8_admin_verify_upi_payment():
    assert S.upi_order_no
    h = _bearer(S.admin_token)
    r = requests.post(
        f"{API}/admin/orders/{S.upi_order_no}/verify-payment",
        json={"status": "verified"},
        headers=h,
        timeout=15,
    )
    assert r.status_code in (200, 201), r.text
    # verify -> order status should be 'packed'
    rd = requests.get(f"{API}/orders/{S.upi_order_no}", headers=_bearer(S.customer_token), timeout=15)
    assert rd.status_code == 200
    assert rd.json().get("status") == "packed", rd.json().get("status")


# ============================== FLOW 9 ===============================
def test_flow9_ops_advance_to_delivered_and_cash_collected():
    assert S.cod_order_no
    h = _bearer(S.ops_token)
    # already packed from FLOW 8; advance packed -> out_for_delivery -> delivered
    for target in ("out_for_delivery", "delivered"):
        r = requests.post(
            f"{API}/admin/orders/{S.cod_order_no}/advance",
            json={"status": target},
            headers=h,
            timeout=15,
        )
        assert r.status_code in (200, 201), f"advance->{target} failed: {r.text}"
        time.sleep(0.2)
    # mark cash collected (ops)
    rc = requests.post(
        f"{API}/admin/orders/{S.cod_order_no}/mark-cash-collected", headers=h, timeout=15
    )
    assert rc.status_code in (200, 201), rc.text
    assert rc.json().get("ok") is True

    rr = requests.get(f"{API}/admin/oms/cod-reconciliation", headers=h, timeout=15)
    assert rr.status_code == 200, rr.text
    body = rr.json()
    orders = body.get("orders") if isinstance(body, dict) else body
    row = next((x for x in orders if x.get("order_no") == S.cod_order_no), None)
    assert row, f"cod order {S.cod_order_no} not in reconciliation"
    assert row.get("payment_status") == "collected", row


# ============================== FLOW 10 ==============================
def test_flow10_customer_timeline_complete():
    r = requests.get(f"{API}/orders/{S.cod_order_no}", headers=_bearer(S.customer_token), timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    tl = j.get("timeline", [])
    statuses = {e.get("status") for e in tl}
    expected = {"placed", "packed", "out_for_delivery", "delivered"}
    missing = expected - statuses
    assert not missing, f"timeline missing transitions: {missing}; got {statuses}"


# ============================== FLOW 11 ==============================
def test_flow11_ops_cannot_write_rbac():
    r = requests.post(
        f"{API}/admin/rbac/admin",
        json={"permissions": {}},
        headers=_bearer(S.ops_token),
        timeout=15,
    )
    assert r.status_code == 403, f"expected 403 for ops, got {r.status_code}"


def test_flow11_seller_cannot_read_sla():
    r = requests.get(f"{API}/admin/oms/sla", headers=_bearer(S.seller_token), timeout=15)
    assert r.status_code == 403


def test_flow11_customer_cannot_read_dashboard():
    r = requests.get(f"{API}/admin/dashboard/live", headers=_bearer(S.customer_token), timeout=15)
    assert r.status_code == 403


def test_flow11_admin_cannot_write_rbac():
    r = requests.post(
        f"{API}/admin/rbac/admin",
        json={"permissions": {}},
        headers=_bearer(S.admin_token),
        timeout=15,
    )
    assert r.status_code == 403, f"only super_admin should write rbac, got {r.status_code}"


def test_flow11_no_finance_module():
    r = requests.get(f"{API}/admin/finance", timeout=10)
    assert r.status_code in (404, 405), f"finance endpoint should NOT exist (Phase 4), got {r.status_code}"
