"""Phase 4 backend tests: DPDP, Wishlist, Reviews, UPI-QR, WebSocket, mock fallbacks."""
import os
import json
import time
import asyncio
import pytest
import requests
import websockets

BASE = os.environ.get("REACT_APP_BACKEND_URL", "https://vmart-express.preview.emergentagent.com").rstrip("/")
WS_URL = BASE.replace("https://", "wss://").replace("http://", "ws://") + "/api/ws/oms"

ADMIN_EMAIL = "admin@vfast.local"
ADMIN_PASSWORD = "admin123"
CUSTOMER_PHONE = "+919999999999"


# ---------- fixtures ----------
@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def admin_token(s):
    r = s.post(f"{BASE}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_h(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture(scope="module")
def customer_token(s):
    r = s.post(f"{BASE}/api/auth/otp/request", json={"phone": CUSTOMER_PHONE})
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    assert code, "dev_code missing — mock SMS failed"
    r2 = s.post(f"{BASE}/api/auth/otp/verify", json={"phone": CUSTOMER_PHONE, "code": code})
    assert r2.status_code == 200, r2.text
    return r2.json()["token"]


@pytest.fixture(scope="module")
def cust_h(customer_token):
    return {"Authorization": f"Bearer {customer_token}"}


# ---------- 1. SMS mock fallback ----------
def test_otp_request_returns_dev_code(s):
    r = s.post(f"{BASE}/api/auth/otp/request", json={"phone": CUSTOMER_PHONE})
    assert r.status_code == 200
    data = r.json()
    assert "dev_code" in data
    assert isinstance(data["dev_code"], str) and len(data["dev_code"]) >= 4


# ---------- 2. DPDP overview / banner / consent / rights / grievances / breach ----------
def test_dpdp_overview(s, admin_h):
    r = s.get(f"{BASE}/api/dpdp/overview", headers=admin_h)
    assert r.status_code == 200
    d = r.json()
    for k in ("consents_total", "rights_requests_open", "rights_requests_total",
              "grievances_open", "breaches_open"):
        assert k in d, f"missing {k}"


def test_dpdp_banner_public_get(s):
    r = s.get(f"{BASE}/api/dpdp/banner-settings")
    assert r.status_code == 200
    d = r.json()
    assert "title" in d and "body" in d and "enabled" in d


def test_dpdp_banner_update_persists(s, admin_h):
    new_title = f"TEST Privacy {int(time.time())}"
    r = s.post(f"{BASE}/api/dpdp/banner-settings", headers=admin_h,
               json={"enabled": True, "title": new_title, "body": "TEST body"})
    assert r.status_code == 200
    g = s.get(f"{BASE}/api/dpdp/banner-settings")
    assert g.json()["title"] == new_title
    # restore
    s.post(f"{BASE}/api/dpdp/banner-settings", headers=admin_h,
           json={"enabled": True, "title": "We value your privacy",
                 "body": "VFast uses essential cookies for login & cart. We ask before using marketing or analytics cookies — DPDP Act, 2023."})


def test_dpdp_consent_record_and_list(s, cust_h):
    r = s.post(f"{BASE}/api/dpdp/consents", headers=cust_h,
               json={"purpose": "marketing", "granted": True})
    assert r.status_code == 200, r.text
    assert r.json()["purpose"] == "marketing"
    g = s.get(f"{BASE}/api/dpdp/consents/me", headers=cust_h)
    assert g.status_code == 200
    body = g.json()
    assert "history" in body and "current" in body
    assert any(h["purpose"] == "marketing" for h in body["history"])


def test_dpdp_rights_request_create(s, cust_h):
    r = s.post(f"{BASE}/api/dpdp/rights-requests", headers=cust_h,
               json={"type": "access", "note": "TEST request"})
    assert r.status_code == 200
    assert r.json()["status"] == "open"


def test_dpdp_grievance_filed_and_resolved(s, cust_h, admin_h):
    r = s.post(f"{BASE}/api/dpdp/grievances", headers=cust_h,
               json={"subject": "TEST grievance", "body": "test", "category": "data"})
    assert r.status_code == 200
    gid = r.json()["id"]
    r2 = s.post(f"{BASE}/api/dpdp/grievances/{gid}/resolve", headers=admin_h,
                json={"resolution": "Handled in TEST"})
    assert r2.status_code == 200


def test_dpdp_breach_log(s, admin_h):
    r = s.post(f"{BASE}/api/dpdp/breaches", headers=admin_h,
               json={"title": "TEST breach", "severity": "low", "summary": "test", "users_impacted": 0})
    assert r.status_code == 200
    assert r.json()["severity"] == "low"


# ---------- 3. DPDP erasure — anonymize new throw-away customers (A and B)
#             to verify the unique-tombstone fix (no E11000 on 2nd erasure). ---
def _erase_one(s, admin_h, slot):
    """Create a fresh OTP user with a unique phone, file erasure, admin processes."""
    throwaway_phone = f"+918{int(time.time()) % 100000000:08d}{slot}"
    r = s.post(f"{BASE}/api/auth/otp/request", json={"phone": throwaway_phone})
    assert r.status_code == 200, r.text
    code = r.json()["dev_code"]
    r2 = s.post(f"{BASE}/api/auth/otp/verify", json={"phone": throwaway_phone, "code": code})
    assert r2.status_code == 200, r2.text
    tok = r2.json()["token"]
    th = {"Authorization": f"Bearer {tok}"}
    s.post(f"{BASE}/api/customer/addresses", headers=th,
           json={"name": "TEST", "phone": throwaway_phone, "line1": "1 TEST",
                 "city": "Delhi", "pincode": "110001", "state": "DL"})
    rr = s.post(f"{BASE}/api/dpdp/rights-requests", headers=th,
                json={"type": "erasure", "note": f"TEST erase {slot}"})
    assert rr.status_code == 200, rr.text
    rid = rr.json()["id"]
    pr = s.post(f"{BASE}/api/dpdp/rights-requests/{rid}/process", headers=admin_h,
                json={"status": "completed", "resolution": f"TEST done {slot}"})
    assert pr.status_code == 200, pr.text  # <-- previously 500 with E11000
    body = pr.json()
    assert body.get("erasure_applied") is True
    return rid


def test_dpdp_erasure_anonymizes_user(s, admin_h):
    """Erasure of customer A succeeds AND erasure of customer B right after
    also succeeds — confirms unique-tombstone fix (no users.email_1 dup-key)."""
    rid_a = _erase_one(s, admin_h, "1")
    # Sleep briefly so timestamp+slot guarantees a new phone string for user B
    time.sleep(1)
    rid_b = _erase_one(s, admin_h, "2")

    lst = s.get(f"{BASE}/api/dpdp/rights-requests", headers=admin_h).json()
    ids = {x["id"]: x for x in lst}
    assert rid_a in ids and ids[rid_a]["status"] == "completed"
    assert rid_b in ids and ids[rid_b]["status"] == "completed"


# ---------- 4. Wishlist ----------
def _fetch_products(s):
    r = s.get(f"{BASE}/api/catalog/products?limit=1")
    if r.status_code != 200:
        return []
    body = r.json()
    if isinstance(body, list):
        return body
    return body.get("items", []) or body.get("products", [])


@pytest.fixture(scope="module")
def some_product_id(s):
    items = _fetch_products(s)
    if items:
        return items[0]["id"]
    pytest.skip("no products")


def test_wishlist_add_get_remove(s, cust_h, some_product_id):
    r = s.post(f"{BASE}/api/wishlist/{some_product_id}", headers=cust_h)
    assert r.status_code == 200
    g = s.get(f"{BASE}/api/wishlist", headers=cust_h)
    assert g.status_code == 200
    items = g.json()["items"]
    assert any(p["id"] == some_product_id for p in items)
    d = s.delete(f"{BASE}/api/wishlist/{some_product_id}", headers=cust_h)
    assert d.status_code == 200
    g2 = s.get(f"{BASE}/api/wishlist", headers=cust_h)
    assert not any(p["id"] == some_product_id for p in g2.json()["items"])


# ---------- 5. Reviews ----------
def test_review_pending_then_approve_then_public(s, cust_h, admin_h, some_product_id):
    r = s.post(f"{BASE}/api/products/{some_product_id}/reviews", headers=cust_h,
               json={"rating": 5, "title": "TEST title", "body": "TEST body"})
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    assert r.json()["status"] == "pending"
    # Public list should NOT include it yet
    pub = s.get(f"{BASE}/api/products/{some_product_id}/reviews").json()
    assert not any(rv["id"] == rid for rv in pub.get("reviews", []))
    # Admin moderate
    m = s.post(f"{BASE}/api/admin/reviews/{rid}/moderate", headers=admin_h,
               json={"status": "approved"})
    assert m.status_code == 200
    # Now public
    pub2 = s.get(f"{BASE}/api/products/{some_product_id}/reviews").json()
    assert any(rv["id"] == rid for rv in pub2["reviews"])


# ---------- 6. UPI QR ----------
def test_active_qr_public_and_pin_fallback(s):
    r = s.get(f"{BASE}/api/catalog/active-qr")
    assert r.status_code == 200
    d = r.json()
    assert "upi_id" in d
    # pin-scoped fallback to global
    r2 = s.get(f"{BASE}/api/catalog/active-qr?pincode=110001")
    assert r2.status_code == 200
    assert r2.json().get("upi_id")


# ---------- 7. WebSocket ----------
def test_ws_hello_and_order_broadcast(admin_token):
    """Connect, get hello, then place an order via REST and expect order.created."""
    async def run():
        async with websockets.connect(WS_URL, open_timeout=10) as ws:
            hello = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
            assert hello.get("event") == "hello"
            assert hello.get("clients", 0) >= 1

            # Place an order using customer token
            sx = requests.Session()
            r = sx.post(f"{BASE}/api/auth/otp/request", json={"phone": CUSTOMER_PHONE})
            code = r.json()["dev_code"]
            r = sx.post(f"{BASE}/api/auth/otp/verify", json={"phone": CUSTOMER_PHONE, "code": code})
            ct = r.json()["token"]
            ch = {"Authorization": f"Bearer {ct}"}
            pr = sx.get(f"{BASE}/api/catalog/products?limit=1").json()
            items = pr if isinstance(pr, list) else (pr.get("items") or [])
            pid = items[0]["id"]
            sx.post(f"{BASE}/api/cart/set", headers=ch,
                    json={"items": [{"product_id": pid, "qty": 1}], "pincode": "110001"})
            address = {"label": "Home", "flat": "1A", "area": "TEST", "city": "Delhi",
                       "state": "DL", "pincode": "110001", "phone": CUSTOMER_PHONE}
            po = sx.post(f"{BASE}/api/orders/", headers=ch,
                         json={"address": address, "payment_method": "cod"})
            assert po.status_code == 200, po.text

            # Read events for up to 8s
            order_no = po.json().get("order_no")
            got = False
            try:
                while True:
                    msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=8))
                    if msg.get("event") == "order.created" and msg.get("order_no"):
                        got = True
                        break
            except asyncio.TimeoutError:
                pass
            assert got, f"order.created event not received for {order_no}"

    asyncio.run(run())


# ---------- 8. Regression: route 400 not 500 ----------
def test_admin_product_empty_payload_400(s, admin_h):
    r = s.post(f"{BASE}/api/admin/catalog/products", headers=admin_h, json={})
    assert r.status_code == 400, f"expected 400, got {r.status_code}: {r.text[:200]}"


# ---------- 9. Mock log verification ----------
def test_mock_sms_log_present(s):
    """Trigger OTP then look for [MOCK SMS] line in backend log."""
    s.post(f"{BASE}/api/auth/otp/request", json={"phone": CUSTOMER_PHONE})
    time.sleep(0.5)
    log_paths = ["/var/log/supervisor/backend.out.log", "/var/log/supervisor/backend.err.log"]
    found = False
    for p in log_paths:
        if os.path.exists(p):
            with open(p, "r", errors="ignore") as f:
                content = f.read()[-50000:]
            if "[MOCK SMS]" in content:
                found = True
                break
    assert found, "No [MOCK SMS] line found in backend logs"


def test_mock_email_and_push_log_after_order(s, cust_h):
    """After fix in orders.py (guards removed), placing an order as an
    OTP-only user MUST always emit [MOCK EMAIL] and [MOCK PUSH] lines in
    backend logs because services/email.py and services/push.py log them
    when recipients/provider keys are missing."""
    pr = s.get(f"{BASE}/api/catalog/products?limit=1").json()
    items = pr if isinstance(pr, list) else (pr.get("items") or [])
    pid = items[0]["id"]
    s.post(f"{BASE}/api/cart/set", headers=cust_h,
           json={"items": [{"product_id": pid, "qty": 1}], "pincode": "110001"})
    address = {"label": "Home", "flat": "1A", "area": "TEST", "city": "Delhi",
               "state": "DL", "pincode": "110001", "phone": CUSTOMER_PHONE}
    po = s.post(f"{BASE}/api/orders/", headers=cust_h,
                json={"address": address, "payment_method": "cod"})
    assert po.status_code == 200, po.text
    order_no = po.json().get("order_no") or ""

    # Give the side-effects a moment to flush to log
    time.sleep(1.5)

    log_paths = ["/var/log/supervisor/backend.out.log",
                 "/var/log/supervisor/backend.err.log"]
    found_email = found_push = False
    for p in log_paths:
        if not os.path.exists(p):
            continue
        with open(p, "r", errors="ignore") as f:
            content = f.read()[-300000:]
        if "[MOCK EMAIL]" in content:
            found_email = True
        if "[MOCK PUSH]" in content:
            found_push = True
    assert found_email, f"No [MOCK EMAIL] line in backend logs after order {order_no}"
    assert found_push, f"No [MOCK PUSH] line in backend logs after order {order_no}"
