from .auth import router as auth_router
from .catalog import router as catalog_router
from .serviceability import router as serviceability_router
from .cart import router as cart_router
from .orders import router as orders_router
from .payments import router as payments_router
from .admin import router as admin_router
from .admin_more import router as admin_more_router
from .misc import router as misc_router
from .finance import router as finance_router
from .marketing import router as marketing_router, public_router as marketing_public_router
from .crm import router as crm_router
from .analytics import router as analytics_router
from .seller import router as seller_router
from .rider import router as rider_router
from .customer import router as customer_router
from .dpdp import router as dpdp_router
from .social import router as social_router, admin_router as social_admin_router
from .realtime import router as realtime_router

__all__ = [
    "auth_router",
    "catalog_router",
    "serviceability_router",
    "cart_router",
    "orders_router",
    "payments_router",
    "admin_router",
    "admin_more_router",
    "misc_router",
    "finance_router",
    "marketing_router",
    "marketing_public_router",
    "crm_router",
    "analytics_router",
    "seller_router",
    "rider_router",
    "customer_router",
    "dpdp_router",
    "social_router",
    "social_admin_router",
    "realtime_router",
]
