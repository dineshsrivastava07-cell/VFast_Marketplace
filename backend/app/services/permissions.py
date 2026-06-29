"""RBAC permission matrix used by the role-management UI.

Modules → list of action keys. Permissions are stored in the `role_permissions`
collection with shape { role: str, permissions: {module: [actions]} }.
"""
from __future__ import annotations

MODULES = [
    "dashboard", "orders", "catalog", "inventory", "pincodes", "qr_codes",
    "stores", "zones", "riders", "users", "rbac", "audit", "settings",
    "payments", "campaigns",
]

ACTIONS = ["read", "write", "delete"]

# Default role → permissions matrix.
DEFAULT_PERMISSIONS = {
    "super_admin": {m: ["read", "write", "delete"] for m in MODULES},
    "admin": {m: ["read", "write", "delete"] for m in MODULES if m != "rbac"} | {"rbac": ["read"]},
    "operations": {
        "dashboard": ["read"], "orders": ["read", "write"], "catalog": ["read"],
        "inventory": ["read", "write"], "pincodes": ["read"], "qr_codes": ["read"],
        "stores": ["read"], "zones": ["read"], "riders": ["read", "write"],
        "payments": ["read", "write"], "campaigns": ["read"],
        "users": ["read"], "rbac": [], "audit": ["read"], "settings": ["read"],
    },
    "seller": {
        "dashboard": ["read"], "orders": ["read"], "catalog": ["read", "write"],
        "inventory": ["read", "write"],
    },
    "delivery_partner": {
        "dashboard": ["read"], "orders": ["read", "write"],
    },
    "customer": {},
}


def can(perm_doc: dict, module: str, action: str) -> bool:
    if not perm_doc:
        return False
    if perm_doc.get("role") == "super_admin":
        return True
    return action in (perm_doc.get("permissions", {}).get(module, []) or [])
