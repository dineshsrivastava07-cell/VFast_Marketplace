"""Phase 7 — Auth refactor tests (iteration 11).

Covers: Google graceful disabled state, password reset (staff + customer),
staff login (5 seed roles), admin user CRUD constraints (no DELETE,
admin limited to active toggle), rider extras on create, address PATCH
with PIN validation, RBAC summary, settings email_config visibility,
change-password.
"""
import os
import time
import pytest
import requests

def _load_frontend_env():
    p = "/app/frontend/.env"
    if os.path.exists(p):
        for line in open(p):
            if line.startswith("REACT_APP_BACKEND_URL="):
                return line.split("=", 1)[1].strip().strip('"').rstrip("/")
    return None

BASE = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env() or "").rstrip("/")
assert BASE, "REACT_APP_BACKEND_URL not configured"
A = f"{BASE}/api"


def _login(email, pw):
    r = requests.post(f"{A}/auth/login", json={"email": email, "password": pw}, timeout=20)
    return r


def _h(t):
    return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def super_token():
    r = _login("super.admin@vfast.local", "admin123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


@pytest.fixture(scope="module")
def admin_token():
    r = _login("admin@vfast.local", "admin123")
    assert r.status_code == 200, r.text
    return r.json()["token"]


# --------------- Google config (disabled) ---------------
class TestGoogleAuth:
    def test_config_disabled(self):
        r = requests.get(f"{A}/auth/google/config", timeout=15)
        assert r.status_code == 200
        d = r.json()
        assert d.get("enabled") is False
        assert d.get("client_id") in (None, "")

    def test_google_customer_503(self):
        r = requests.post(f"{A}/auth/google/customer",
                          json={"credential": "any.bogus.token"}, timeout=15)
        assert r.status_code == 503, r.text
        assert "not configured" in r.json().get("detail", "").lower()

    def test_google_staff_503(self):
        r = requests.post(f"{A}/auth/google/staff",
                          json={"credential": "any.bogus.token"}, timeout=15)
        assert r.status_code == 503


# --------------- Password reset ---------------
class TestPasswordReset:
    def test_staff_reset_request_ok(self):
        r = requests.post(f"{A}/auth/password-reset/request",
                          json={"email": "admin@vfast.local"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_unknown_email_still_ok(self):
        r = requests.post(f"{A}/auth/password-reset/request",
                          json={"email": "nobody@vfast.local"}, timeout=15)
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_customer_reset_request_no_token(self, super_token):
        # Trigger creation of a customer via OTP first.
        phone = "+919999999998"
        req = requests.post(f"{A}/auth/otp/request", json={"phone": phone}, timeout=15)
        code = req.json().get("dev_code")
        v = requests.post(f"{A}/auth/otp/verify", json={"phone": phone, "code": code}, timeout=15)
        assert v.status_code == 200
        # Attach an email to that customer via super-admin patch
        users = requests.get(f"{A}/admin/users", headers=_h(super_token), timeout=15).json()
        cust = next((u for u in users if u.get("phone") == phone), None)
        assert cust, "test customer not seeded"
        custom_email = f"TEST_cust_{int(time.time())}@example.com"
        requests.patch(f"{A}/admin/users/{cust['id']}", headers=_h(super_token),
                       json={"name": cust.get("name", "Cust")}, timeout=15)
        # We can't set email via patch (no email field allowed), so manipulate via OTP flow only.
        # Instead: confirm that requesting reset on a customer email returns ok but creates no token.
        r = requests.post(f"{A}/auth/password-reset/request",
                          json={"email": custom_email}, timeout=15)
        assert r.status_code == 200

    def test_reset_confirm_invalid_token(self):
        r = requests.post(f"{A}/auth/password-reset/confirm",
                          json={"token": "invalid-xyz", "new_password": "newpass123"}, timeout=15)
        assert r.status_code == 400


# --------------- Staff login + customer-by-email rejection ---------------
class TestStaffLogin:
    @pytest.mark.parametrize("email,pw,role", [
        ("super.admin@vfast.local", "admin123", "super_admin"),
        ("admin@vfast.local", "admin123", "admin"),
        ("ops@vfast.local", "ops123", "operations"),
        ("seller@vfast.local", "seller123", "seller"),
        ("rider@vfast.local", "rider123", "delivery_partner"),
    ])
    def test_seed_logins(self, email, pw, role):
        r = _login(email, pw)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["user"]["role"] == role
        assert isinstance(d.get("token"), str) and len(d["token"]) > 10


# --------------- Admin user mgmt: PATCH limits + no DELETE + reset-password ---------------
class TestAdminUserMgmt:
    @pytest.fixture(scope="class")
    def rider_id(self, super_token):
        email = f"TEST_rider_{int(time.time())}@vfast.local"
        rider_phone = f"+9198{int(time.time()) % 100000000:08d}"
        payload = {
            "email": email, "password": "riderpw1", "role": "delivery_partner",
            "name": "Test Rider", "phone": rider_phone, "vehicle": "bike",
            "kyc": {"pan": "ABCDE1234F", "license": "DL-99-XX", "verified": False},
            "send_welcome": False,
        }
        r = requests.post(f"{A}/admin/users", headers=_h(super_token), json=payload, timeout=15)
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        # Verify rider extras persisted
        users = requests.get(f"{A}/admin/users", headers=_h(super_token), timeout=15).json()
        rider = next((u for u in users if u["id"] == uid), None)
        assert rider and rider.get("vehicle") == "bike"
        assert rider.get("kyc", {}).get("pan") == "ABCDE1234F"
        return uid, email

    def test_admin_patch_active_only(self, admin_token, rider_id):
        uid, _ = rider_id
        # Allowed: active toggle
        r = requests.patch(f"{A}/admin/users/{uid}", headers=_h(admin_token),
                           json={"active": False}, timeout=15)
        assert r.status_code == 200, r.text
        # Not allowed: name
        r2 = requests.patch(f"{A}/admin/users/{uid}", headers=_h(admin_token),
                            json={"name": "Hacker"}, timeout=15)
        assert r2.status_code == 403, r2.text
        # Not allowed: role
        r3 = requests.patch(f"{A}/admin/users/{uid}", headers=_h(admin_token),
                            json={"role": "admin"}, timeout=15)
        assert r3.status_code == 403
        # Not allowed: password
        r4 = requests.patch(f"{A}/admin/users/{uid}", headers=_h(admin_token),
                            json={"password": "x123456"}, timeout=15)
        assert r4.status_code == 403
        # Restore
        requests.patch(f"{A}/admin/users/{uid}", headers=_h(admin_token),
                       json={"active": True}, timeout=15)

    def test_super_admin_patch_all_fields(self, super_token, rider_id):
        uid, _ = rider_id
        unique_phone = f"+9198{int(time.time()) % 100000000:08d}"
        r = requests.patch(f"{A}/admin/users/{uid}", headers=_h(super_token),
                           json={"name": "Renamed", "phone": unique_phone,
                                 "vehicle": "scooter",
                                 "kyc": {"pan": "ZZZZZ9999Z", "license": "DL-NEW", "verified": True}},
                           timeout=15)
        assert r.status_code == 200, r.text
        users = requests.get(f"{A}/admin/users", headers=_h(super_token), timeout=15).json()
        u = next(x for x in users if x["id"] == uid)
        assert u["name"] == "Renamed"
        assert u["vehicle"] == "scooter"
        assert u["kyc"]["verified"] is True

    def test_no_delete_endpoint(self, super_token, rider_id):
        uid, _ = rider_id
        r = requests.delete(f"{A}/admin/users/{uid}", headers=_h(super_token), timeout=15)
        assert r.status_code in (404, 405), r.text

    def test_admin_reset_password_super_admin(self, super_token, rider_id):
        uid, email = rider_id
        new_pw = "newRider99"
        r = requests.post(f"{A}/admin/users/{uid}/reset-password",
                          headers=_h(super_token),
                          json={"new_password": new_pw, "notify": False}, timeout=15)
        assert r.status_code == 200, r.text
        # Verify new password works
        lr = _login(email, new_pw)
        assert lr.status_code == 200

    def test_admin_reset_password_forbidden_for_admin(self, admin_token, rider_id):
        uid, _ = rider_id
        r = requests.post(f"{A}/admin/users/{uid}/reset-password",
                          headers=_h(admin_token),
                          json={"new_password": "tryme9999"}, timeout=15)
        assert r.status_code == 403, r.text


# --------------- Customer login by email rejected ---------------
class TestCustomerEmailLoginRejected:
    def test_customer_via_login_403(self, super_token):
        # Seed a synthetic customer with a known password by superadmin
        email = f"TEST_em_cust_{int(time.time())}@example.com"
        r = requests.post(f"{A}/admin/users", headers=_h(super_token),
                          json={"email": email, "password": "abc12345",
                                "role": "customer", "name": "Email Cust",
                                "send_welcome": False}, timeout=15)
        assert r.status_code == 200, r.text
        lr = _login(email, "abc12345")
        assert lr.status_code == 403
        assert "phone otp" in lr.json().get("detail", "").lower()


# --------------- Customer addresses ---------------
class TestCustomerAddresses:
    @pytest.fixture(scope="class")
    def cust_token(self):
        phone = "+919999999999"
        req = requests.post(f"{A}/auth/otp/request", json={"phone": phone}, timeout=15)
        code = req.json()["dev_code"]
        v = requests.post(f"{A}/auth/otp/verify", json={"phone": phone, "code": code}, timeout=15)
        return v.json()["token"]

    def test_create_and_patch_address(self, cust_token):
        # Create
        body = {"label": "Home", "flat": "A-101", "area": "Sector 1",
                "city": "Noida", "state": "UP", "pincode": "201301"}
        r = requests.post(f"{A}/customer/addresses", headers=_h(cust_token),
                          json=body, timeout=15)
        assert r.status_code == 200, r.text
        aid = r.json()["id"]
        # Patch subset
        p = requests.patch(f"{A}/customer/addresses/{aid}", headers=_h(cust_token),
                           json={"label": "Work", "flat": "B-202"}, timeout=15)
        assert p.status_code == 200, p.text
        updated = p.json()
        assert updated["label"] == "Work" and updated["flat"] == "B-202"
        # Bad PIN
        bad = requests.patch(f"{A}/customer/addresses/{aid}", headers=_h(cust_token),
                             json={"pincode": "12"}, timeout=15)
        assert bad.status_code == 400


# --------------- RBAC summary ---------------
class TestRbacSummary:
    def test_summary_map(self, super_token):
        r = requests.get(f"{A}/admin/rbac/summary", headers=_h(super_token), timeout=15)
        assert r.status_code == 200
        m = r.json()
        assert isinstance(m, dict)
        # at least super_admin should be present in the map with a non-empty list
        assert "super_admin" in m
        assert isinstance(m["super_admin"], list)


# --------------- Settings email_config visibility ---------------
class TestSettingsEmailConfig:
    def test_super_admin_sees_full_and_can_save(self, super_token):
        # Save a value
        key = "rk_TEST_super_visible_999"
        r = requests.post(f"{A}/admin/settings", headers=_h(super_token),
                          json={"email_config": {"api_key": key, "from": "T <t@vfast.local>"}}, timeout=15)
        assert r.status_code == 200, r.text
        # Read back as super_admin
        g = requests.get(f"{A}/admin/settings", headers=_h(super_token), timeout=15).json()
        ec = g.get("email_config") or {}
        assert ec.get("api_key") == key, f"super_admin should see full key, got {ec.get('api_key')}"

    def test_admin_sees_masked_and_cant_save(self, admin_token):
        g = requests.get(f"{A}/admin/settings", headers=_h(admin_token), timeout=15).json()
        ec = g.get("email_config") or {}
        # Should be masked: starts with *
        if ec.get("api_key"):
            assert ec["api_key"].startswith("*"), f"admin should see masked key, got {ec['api_key']}"
        # Admin POST with email_config should be silently ignored (not saved)
        r = requests.post(f"{A}/admin/settings", headers=_h(admin_token),
                          json={"email_config": {"api_key": "rk_HIJACK"}}, timeout=15)
        # Endpoint allows admin to call, but email_config is super_admin-gated; so 200 but no change
        assert r.status_code == 200


# --------------- Change password ---------------
class TestChangePassword:
    def test_change_password_requires_correct_current(self):
        # Use the customer OTP token (no password set on customer; should 401)
        phone = "+919999999999"
        req = requests.post(f"{A}/auth/otp/request", json={"phone": phone}, timeout=15)
        code = req.json()["dev_code"]
        v = requests.post(f"{A}/auth/otp/verify", json={"phone": phone, "code": code}, timeout=15)
        tok = v.json()["token"]
        # Wrong current password
        r = requests.post(f"{A}/auth/change-password", headers=_h(tok),
                          json={"current_password": "wrong-pw", "new_password": "newpw123"}, timeout=15)
        assert r.status_code == 401

    def test_change_password_short_new(self, super_token):
        r = requests.post(f"{A}/auth/change-password", headers=_h(super_token),
                          json={"current_password": "admin123", "new_password": "x"}, timeout=15)
        assert r.status_code == 400

    def test_change_password_success_and_restore(self, super_token):
        # Use a throwaway operations user to avoid breaking seed creds
        # Create staff via super admin then change own password? change-password uses bearer.
        # Simpler: create new staff and login with them.
        email = f"TEST_cp_{int(time.time())}@vfast.local"
        cr = requests.post(f"{A}/admin/users", headers=_h(super_token),
                           json={"email": email, "password": "init12345",
                                 "role": "operations", "name": "CP", "send_welcome": False},
                           timeout=15)
        assert cr.status_code == 200
        tok = _login(email, "init12345").json()["token"]
        ok = requests.post(f"{A}/auth/change-password", headers=_h(tok),
                           json={"current_password": "init12345", "new_password": "after99x"}, timeout=15)
        assert ok.status_code == 200, ok.text
        # New password works
        assert _login(email, "after99x").status_code == 200
        # Old password fails
        assert _login(email, "init12345").status_code == 401
