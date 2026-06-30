"""Phase 5 — Super-admin user CRUD endpoints + RBAC + validation."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://vmart-express.preview.emergentagent.com").rstrip("/")

SUPER = {"email": "super.admin@vfast.local", "password": "admin123"}
ADMIN = {"email": "admin@vfast.local", "password": "admin123"}


def _login(creds):
    r = requests.post(f"{BASE_URL}/api/auth/login", json=creds, timeout=20)
    assert r.status_code == 200, r.text
    return r.json().get("access_token") or r.json().get("token")


@pytest.fixture(scope="module")
def super_token():
    return _login(SUPER)


@pytest.fixture(scope="module")
def admin_token():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def fresh_email():
    return f"qa.create.{int(time.time())}@vfast.local"


def h(t):
    return {"Authorization": f"Bearer {t}"}


class TestUserAdminCRUD:
    def test_create_user_as_super(self, super_token, fresh_email):
        r = requests.post(f"{BASE_URL}/api/admin/users",
                          json={"email": fresh_email, "password": "Test@123",
                                "role": "admin", "name": "QA Create"},
                          headers=h(super_token), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("action") == "created"
        assert body.get("id")
        # Verify new user can log in
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": fresh_email, "password": "Test@123"}, timeout=20)
        assert login.status_code == 200, login.text

    def test_upsert_existing_email_updates(self, super_token):
        # Use admin@vfast.local — should be 'updated' and password changed
        r = requests.post(f"{BASE_URL}/api/admin/users",
                          json={"email": "admin@vfast.local", "password": "admin456",
                                "role": "admin", "name": "Admin Renamed"},
                          headers=h(super_token), timeout=20)
        assert r.status_code == 200, r.text
        assert r.json().get("action") == "updated"
        # New password works
        ok = requests.post(f"{BASE_URL}/api/auth/login",
                          json={"email": "admin@vfast.local", "password": "admin456"}, timeout=20)
        assert ok.status_code == 200, ok.text
        # Restore original password for downstream test stability
        restore = requests.post(f"{BASE_URL}/api/admin/users",
                                json={"email": "admin@vfast.local", "password": "admin123",
                                      "role": "admin", "name": "Admin"},
                                headers=h(super_token), timeout=20)
        assert restore.status_code == 200

    def test_patch_user_keeps_password_when_blank(self, super_token, fresh_email):
        # Find user id
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=h(super_token), timeout=20).json()
        target = next(u for u in users if u.get("email") == fresh_email)
        r = requests.patch(f"{BASE_URL}/api/admin/users/{target['id']}",
                           json={"name": "QA Renamed", "role": "operations", "password": ""},
                           headers=h(super_token), timeout=20)
        assert r.status_code == 200, r.text
        # Old password still works
        login = requests.post(f"{BASE_URL}/api/auth/login",
                              json={"email": fresh_email, "password": "Test@123"}, timeout=20)
        assert login.status_code == 200
        # Verify role and name updated via list
        users2 = requests.get(f"{BASE_URL}/api/admin/users", headers=h(super_token), timeout=20).json()
        updated = next(u for u in users2 if u.get("email") == fresh_email)
        assert updated["name"] == "QA Renamed"
        assert updated["role"] == "operations"

    def test_admin_role_forbidden(self, admin_token):
        r = requests.post(f"{BASE_URL}/api/admin/users",
                          json={"email": "should.fail@vfast.local", "password": "x", "role": "admin"},
                          headers=h(admin_token), timeout=20)
        assert r.status_code == 403, r.text
        r2 = requests.patch(f"{BASE_URL}/api/admin/users/whatever",
                            json={"name": "x"}, headers=h(admin_token), timeout=20)
        assert r2.status_code == 403

    def test_validation_invalid_role(self, super_token):
        r = requests.post(f"{BASE_URL}/api/admin/users",
                          json={"email": "x@vfast.local", "password": "x", "role": "not_a_role"},
                          headers=h(super_token), timeout=20)
        assert r.status_code == 400
        assert "valid role" in r.json().get("detail", "")

    def test_validation_missing_password_create(self, super_token):
        r = requests.post(f"{BASE_URL}/api/admin/users",
                          json={"email": f"nopw.{int(time.time())}@vfast.local", "role": "admin"},
                          headers=h(super_token), timeout=20)
        assert r.status_code == 400

    def test_patch_invalid_role(self, super_token, fresh_email):
        users = requests.get(f"{BASE_URL}/api/admin/users", headers=h(super_token), timeout=20).json()
        target = next(u for u in users if u.get("email") == fresh_email)
        r = requests.patch(f"{BASE_URL}/api/admin/users/{target['id']}",
                           json={"role": "not_a_role"}, headers=h(super_token), timeout=20)
        assert r.status_code == 400

    def test_patch_nonexistent_user(self, super_token):
        r = requests.patch(f"{BASE_URL}/api/admin/users/nonexistent-xyz-123",
                           json={"name": "x"}, headers=h(super_token), timeout=20)
        assert r.status_code == 404

    def test_list_users_no_password_hash(self, super_token):
        r = requests.get(f"{BASE_URL}/api/admin/users", headers=h(super_token), timeout=20)
        assert r.status_code == 200
        for u in r.json():
            assert "password_hash" not in u
            assert "_id" not in u


class TestSeedDemoUsers:
    """Verify code path; we cannot mutate env vars at runtime."""
    def test_demo_users_has_7_entries(self):
        from app.seed import DEMO_USERS
        assert len(DEMO_USERS) == 7
        emails = [d[0] for d in DEMO_USERS]
        assert "SUPER_ADMIN2_EMAIL" in emails
        assert "SUPER_ADMIN3_EMAIL" in emails
