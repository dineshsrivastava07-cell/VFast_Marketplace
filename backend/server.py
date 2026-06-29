"""VFast Marketplace - FastAPI backend (Phase 1).

Modules wired together here: auth (OTP + email/password JWT), catalog,
serviceability, cart, orders, payments (COD + UPI-QR with proof), admin.
"""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os  # noqa: E402
import logging  # noqa: E402
from fastapi import FastAPI  # noqa: E402
from fastapi.staticfiles import StaticFiles  # noqa: E402
from starlette.middleware.cors import CORSMiddleware  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

from app.routes import (  # noqa: E402
    auth_router,
    catalog_router,
    serviceability_router,
    cart_router,
    orders_router,
    payments_router,
    admin_router,
    admin_more_router,
    misc_router,
    finance_router,
    marketing_router,
    marketing_public_router,
    crm_router,
    analytics_router,
    seller_router,
    rider_router,
    customer_router,
)
from app.seed import run_seed  # noqa: E402

# ---------------- Mongo ---------------- #
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI(title="VFast Marketplace API", version="1.0.0")

UPLOAD_DIR = ROOT_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/api/static/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Routers (each already prefixed with /api/...)
for router in [
    auth_router,
    catalog_router,
    serviceability_router,
    cart_router,
    orders_router,
    payments_router,
    admin_router,
    admin_more_router,
    misc_router,
    finance_router,
    marketing_router,
    marketing_public_router,
    crm_router,
    analytics_router,
    seller_router,
    rider_router,
    customer_router,
]:
    app.include_router(router)


@app.on_event("startup")
async def on_startup():
    # Indexes
    await db.users.create_index("email", unique=True, sparse=True)
    await db.users.create_index("phone", unique=True, sparse=True)
    await db.products.create_index("slug", unique=True)
    await db.categories.create_index("slug", unique=True)
    await db.serviceable_pincodes.create_index("pincode", unique=True)
    await db.orders.create_index("order_no", unique=True)
    # Seed demo data and demo accounts
    await run_seed(db)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)


# Inject db into request.state for route modules to use
@app.middleware("http")
async def attach_db(request, call_next):
    request.state.db = db
    return await call_next(request)
