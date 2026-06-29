from .auth import router as auth_router
from .catalog import router as catalog_router
from .serviceability import router as serviceability_router
from .cart import router as cart_router
from .orders import router as orders_router
from .payments import router as payments_router
from .admin import router as admin_router
from .misc import router as misc_router

__all__ = [
    "auth_router",
    "catalog_router",
    "serviceability_router",
    "cart_router",
    "orders_router",
    "payments_router",
    "admin_router",
    "misc_router",
]
