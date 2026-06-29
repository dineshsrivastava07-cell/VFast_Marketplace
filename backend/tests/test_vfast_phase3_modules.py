"""Phase 3 - 18 new modules e2e tests.

Covers: Finance, Marketing, CRM, Analytics, Seller (KYC + catalog),
Rider, Customer profile/addresses, plus RBAC + regression on OTP/orders.
"""
from __future__ import annotations

import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vmart-express.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

SUPER = ("super.admin@vfast.local", "admin123")
ADMIN = ("admin@vfast.local", "admin123")
OPS = ("ops@vfast.local", "ops123")
SELLER = ("seller@vfast.local", "seller123")
RIDER = ("rider@vfast.local", "rider123")
CUSTOMER_PHONE = "+919999999999"


# ----------------- helpers ------------------
def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=15)
    assert r.status_code == 200, f"login {email}: {r.status_code} {r.text}"
    return r.json()["token"]


def _hdr(tok):
    return {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}


def _customer_token():
    r = requests.post(f"{API}/auth/otp/request", json={"phone": CUSTOMER_PHONE}, timeout=15)
    assert r.status_code == 200, r.text
    code = r.json().get("dev_code")
    assert code
    r = requests.post(f"{API}/auth/otp/verify", json={"phone": CUSTOMER_PHONE, "code": code}, timeout=15)
    assert r.status_code == 200, r.text
    j = r.json()
    return j["token"], j["user"]


@pytest.fixture(scope="session")
def admin_token():
    return _login(*ADMIN)


@pytest.fixture(scope="session")
def super_token():
    return _login(*SUPER)


@pytest.fixture(scope="session")
def seller_token():
    return _login(*SELLER)


@pytest.fixture(scope="session")
def rider_token():
    return _login(*RIDER)


@pytest.fixture(scope="session")
def customer_token():
    tok, user = _customer_token()
    return tok


@pytest.fixture(scope="session")
def customer_user():
    tok, user = _customer_token()
    return user


# ==================== FINANCE ====================
class TestFinance:
    def test_finance_summary(self, admin_token):
        r = requests.get(f"{API}/finance/summary?days=30", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "summary" in j and "daily" in j and "by_method" in j
        assert "gmv" in j["summary"] and "orders" in j["summary"] and "aov" in j["summary"]
        assert isinstance(j["daily"], list) and len(j["daily"]) == 30

    def test_cod_reconciliation(self, admin_token):
        r = requests.get(f"{API}/finance/cod-reconciliation", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        s = j["summary"]
        # field naming: collected_orders/pending_orders (per code), amount_collected/amount_pending
        assert "amount_collected" in s and "amount_pending" in s
        assert "by_rider" in j and "orders" in j

    def test_settlements_preview(self, admin_token):
        r = requests.get(f"{API}/finance/settlements/preview", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "rows" in j and isinstance(j["rows"], list)
        for row in j["rows"]:
            assert "seller_id" in row and "gmv" in row and "commission" in row and "payout" in row

    def test_settlements_create_list_mark_paid(self, admin_token):
        payload = {
            "seller_id": f"TEST_seller_{uuid.uuid4().hex[:6]}",
            "seller_name": "TEST seller",
            "period_from": "2026-01-01",
            "period_to": "2026-01-31",
            "gmv": 1000.0, "commission": 100.0, "payout": 900.0,
        }
        r = requests.post(f"{API}/finance/settlements/create", json=payload, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        sid = r.json()["id"]

        r = requests.get(f"{API}/finance/settlements", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        assert any(s["id"] == sid for s in rows)
        assert next(s for s in rows if s["id"] == sid)["status"] == "pending"

        r = requests.post(f"{API}/finance/settlements/{sid}/mark-paid",
                          json={"utr": "TESTUTR1234"}, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text

        r = requests.get(f"{API}/finance/settlements", headers=_hdr(admin_token), timeout=15)
        rows = r.json()
        assert next(s for s in rows if s["id"] == sid)["status"] == "paid"

    def test_refund_create_complete(self, admin_token, customer_token, customer_user):
        # ensure an order exists for the customer (or seed one)
        order_no = _ensure_order(customer_token)
        r = requests.post(f"{API}/finance/refunds",
                          json={"order_no": order_no, "amount": 50, "reason": "TEST refund", "mode": "upi"},
                          headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        rid = r.json()["id"]
        assert r.json()["status"] == "initiated"

        r = requests.post(f"{API}/finance/refunds/{rid}/complete",
                          json={"ref": "TXNREFXYZ"}, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text

    def test_invoice_for_order(self, admin_token, customer_token):
        order_no = _ensure_order(customer_token)
        r = requests.get(f"{API}/finance/invoices/{order_no}", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        inv = r.json()
        assert inv["order_no"] == order_no
        assert "subtotal_excl_gst" in inv and "gst_amount" in inv and "gst_rate" in inv
        assert inv["gst_rate"] == 0.05

    def test_export_gmv_csv(self, admin_token):
        r = requests.get(f"{API}/finance/exports/gmv?days=30", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "csv" in j and len(j["csv"]) > 0
        assert "order_no" in j["csv"]  # header line


# ==================== MARKETING ====================
class TestMarketing:
    def test_banner_crud(self, admin_token):
        payload = {"title": "TEST_BANNER", "image": "https://example.com/x.jpg",
                   "link": "/test", "sort_order": 999}
        r = requests.post(f"{API}/marketing/banners", json=payload, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]

        r = requests.get(f"{API}/marketing/banners", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        assert any(b["id"] == bid for b in r.json())

        r = requests.delete(f"{API}/marketing/banners/{bid}", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200

    def test_coupon_create_and_validate(self, admin_token):
        # Idempotent: upsert WELCOME10
        payload = {"code": "WELCOME10", "type": "percent", "value": 10, "min_order_value": 99, "active": True}
        r = requests.post(f"{API}/marketing/coupons", json=payload, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text

        r = requests.post(f"{API}/marketing/coupons/validate",
                          json={"code": "WELCOME10", "subtotal": 200}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["valid"] is True
        assert j["discount"] == 20.0

    def test_campaign_create_send_list(self, admin_token):
        r = requests.post(f"{API}/marketing/campaigns",
                          json={"name": "TEST_camp", "channel": "sms", "body": "hi", "segment": "all"},
                          headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        cid = r.json()["id"]

        r = requests.post(f"{API}/marketing/campaigns/{cid}/send", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j.get("mocked") is True
        assert "sent_count" in j

        r = requests.get(f"{API}/marketing/campaigns/{cid}/sends", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ==================== CRM ====================
class TestCRM:
    def test_customers_list(self, admin_token):
        r = requests.get(f"{API}/crm/customers", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        rows = r.json()
        assert isinstance(rows, list)
        if rows:
            c = rows[0]
            assert "order_count" in c and "ltv" in c and "segment" in c

    def test_customer_detail(self, admin_token, customer_user):
        r = requests.get(f"{API}/crm/customers/{customer_user['id']}", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "stats" in j or "customer" in j  # accept either shape
        # required: orders + addresses fields existence
        assert "orders" in j and "addresses" in j

    def test_ticket_create_resolve(self, admin_token, customer_user):
        r = requests.post(f"{API}/crm/tickets",
                          json={"user_id": customer_user["id"], "subject": "TEST issue", "description": "..."},
                          headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text
        tid = r.json()["id"]
        r = requests.post(f"{API}/crm/tickets/{tid}/status",
                          json={"status": "resolved"}, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text


# ==================== ANALYTICS ====================
class TestAnalytics:
    def test_overview(self, admin_token):
        r = requests.get(f"{API}/analytics/overview", headers=_hdr(admin_token), timeout=20)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "current" in j and "previous" in j and "deltas" in j

    def test_revenue_trend(self, admin_token):
        r = requests.get(f"{API}/analytics/revenue-trend?days=14", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_top_products(self, admin_token):
        r = requests.get(f"{API}/analytics/top-products", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), (list, dict))

    def test_top_categories(self, admin_token):
        r = requests.get(f"{API}/analytics/top-categories", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200

    def test_by_pincode(self, admin_token):
        r = requests.get(f"{API}/analytics/by-pincode", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200


# ==================== SELLER ====================
class TestSeller:
    def test_seller_dashboard(self, seller_token):
        r = requests.get(f"{API}/seller/dashboard", headers=_hdr(seller_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "products" in j and "kyc_status" in j

    def test_seller_kyc_submit_and_admin_approve(self, seller_token, admin_token):
        r = requests.post(f"{API}/seller/kyc",
                          json={"business_name": "TEST Biz", "gstin": "07AAAAA0000A1Z5",
                                "pan": "ABCDE1234F", "city": "Delhi", "pincode": "110001",
                                "bank_account": "1234567890", "ifsc": "HDFC0001234"},
                          headers=_hdr(seller_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "pending_review"
        kyc_id = r.json()["id"]

        r = requests.get(f"{API}/seller/admin/kyc", headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200
        assert any(k["id"] == kyc_id for k in r.json())

        r = requests.post(f"{API}/seller/admin/kyc/{kyc_id}/approve",
                          json={"status": "approved"}, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text

    def test_seller_create_product_and_list(self, seller_token):
        # find a category (need slug, not id)
        cats = requests.get(f"{API}/catalog/categories", timeout=10).json()
        assert cats, "no categories seeded"
        cat_slug = cats[0]["slug"]

        suffix = uuid.uuid4().hex[:6]
        product = {
            "slug": f"test-seller-prod-{suffix}",
            "name": f"TEST_seller_prod_{suffix}",
            "category_slug": cat_slug,
            "price": 99,
            "mrp": 120,
            "unit": "1 pc",
            "image": "https://example.com/p.jpg",
            "stock": 50,
        }
        # As seller — backend auto-sets seller_id from token
        r = requests.post(f"{API}/admin/catalog/products", json=product,
                          headers=_hdr(seller_token), timeout=15)
        assert r.status_code in (200, 201), r.text

        r = requests.get(f"{API}/seller/products", headers=_hdr(seller_token), timeout=15)
        assert r.status_code == 200
        names = [p["name"] for p in r.json()]
        assert product["name"] in names


# ==================== RIDER ====================
class TestRider:
    def test_rider_availability(self, rider_token):
        r = requests.post(f"{API}/rider/availability",
                          json={"status": "online"}, headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 200, r.text
        assert r.json()["status"] == "online"

    def test_rider_available_list(self, rider_token):
        r = requests.get(f"{API}/rider/available", headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_rider_earnings(self, rider_token):
        r = requests.get(f"{API}/rider/earnings", headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "daily" in j and "total_14d" in j
        assert isinstance(j["daily"], list)

    def test_rider_full_delivery_flow(self, rider_token, admin_token, customer_token):
        """End-to-end: create order, advance to packed (no rider), rider accepts, pickup, deliver."""
        order_no = _ensure_order(customer_token, payment_method="cod")
        # advance to packed (ops/admin)
        r = requests.post(f"{API}/admin/orders/{order_no}/advance",
                          json={"status": "packed"}, headers=_hdr(admin_token), timeout=15)
        assert r.status_code == 200, r.text

        r = requests.post(f"{API}/rider/orders/{order_no}/accept",
                          headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 200, r.text

        r = requests.post(f"{API}/rider/orders/{order_no}/pickup",
                          headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 200, r.text

        r = requests.post(f"{API}/rider/orders/{order_no}/deliver",
                          json={"photo_url": "https://example.com/pod.jpg",
                                "signed_by": "TEST receiver",
                                "cod_collected": True},
                          headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 200, r.text


# ==================== CUSTOMER ====================
class TestCustomer:
    def test_address_crud(self, customer_token):
        payload = {"label": "TEST_addr", "flat": "B-2", "area": "Test Block",
                   "city": "Delhi", "state": "Delhi", "pincode": "110016"}
        r = requests.post(f"{API}/customer/addresses", json=payload,
                          headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]

        r = requests.get(f"{API}/customer/addresses", headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 200
        assert any(a["id"] == aid for a in r.json())

        r = requests.delete(f"{API}/customer/addresses/{aid}",
                            headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 200

    def test_address_invalid_pin(self, customer_token):
        r = requests.post(f"{API}/customer/addresses",
                          json={"label": "x", "pincode": "12345"},
                          headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 400

    def test_profile_update(self, customer_token):
        r = requests.patch(f"{API}/customer/profile",
                           json={"name": "TEST Name", "email": "test@example.com"},
                           headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 200, r.text
        # verify via GET
        r = requests.get(f"{API}/customer/profile", headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 200
        assert r.json()["name"] == "TEST Name"


# ==================== RBAC ====================
class TestRBAC:
    def test_seller_cannot_access_finance(self, seller_token):
        r = requests.get(f"{API}/finance/summary", headers=_hdr(seller_token), timeout=15)
        assert r.status_code == 403, f"Expected 403 got {r.status_code}"

    def test_rider_cannot_access_finance(self, rider_token):
        r = requests.get(f"{API}/finance/summary", headers=_hdr(rider_token), timeout=15)
        assert r.status_code == 403

    def test_customer_cannot_access_admin(self, customer_token):
        r = requests.get(f"{API}/finance/summary", headers=_hdr(customer_token), timeout=15)
        assert r.status_code == 403


# ==================== REGRESSION (OTP + orders) ====================
class TestRegression:
    def test_otp_flow(self):
        r = requests.post(f"{API}/auth/otp/request", json={"phone": CUSTOMER_PHONE}, timeout=15)
        assert r.status_code == 200
        assert "dev_code" in r.json()

    def test_order_place(self, customer_token):
        order_no = _ensure_order(customer_token)
        assert order_no


# ----------------- shared utility ------------------
def _ensure_order(customer_token, payment_method="cod"):
    """Place a fresh order; returns order_no."""
    # fetch a product
    cats = requests.get(f"{API}/catalog/categories", timeout=15).json()
    cat_id = cats[0]["id"]
    prods = requests.get(f"{API}/catalog/products?category_id={cat_id}", timeout=15).json()
    items = prods if isinstance(prods, list) else prods.get("products", [])
    pid = items[0]["id"]

    # set cart
    requests.post(f"{API}/cart/set",
                  json={"items": [{"product_id": pid, "qty": 2}]},
                  headers=_hdr(customer_token), timeout=15)
    payload = {
        "address": {"label": "Home", "flat": "B-1", "area": "CP",
                    "city": "Delhi", "state": "Delhi", "pincode": "110001",
                    "phone": CUSTOMER_PHONE},
        "payment_method": payment_method,
    }
    r = requests.post(f"{API}/orders/", json=payload,
                      headers=_hdr(customer_token), timeout=20)
    assert r.status_code in (200, 201), f"order create failed: {r.status_code} {r.text}"
    return r.json()["order_no"]
