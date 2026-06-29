"""Pydantic schemas used by the API.

All MongoDB documents use string `id` (uuid4) instead of ObjectId so JSON
serialization is trivial. Datetimes are stored as ISO strings.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


class BaseDoc(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=new_id)
    created_at: str = Field(default_factory=now_iso)


# ---------------- Auth ---------------- #
class OTPRequest(BaseModel):
    phone: str  # must start with +91


class OTPVerify(BaseModel):
    phone: str
    code: str


class EmailLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    role: str
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


# ---------------- Catalog ---------------- #
class Category(BaseDoc):
    name: str
    slug: str
    tint: str = "#F9FAFB"
    image: str = ""
    sort_order: int = 0


class Product(BaseDoc):
    name: str
    slug: str
    category_id: str
    image: str = ""
    images: List[str] = []
    pack_size: str = ""
    price: float
    mrp: float
    stock: int = 100
    description: str = ""
    eta_minutes: int = 12
    in_stock: bool = True

    @property
    def discount_percent(self) -> int:
        if self.mrp <= 0 or self.price >= self.mrp:
            return 0
        return int(round((1 - self.price / self.mrp) * 100))


# ---------------- Address ---------------- #
class Address(BaseModel):
    label: str = "Home"
    flat: str
    area: str
    landmark: str = ""
    city: str
    state: str
    pincode: str  # 6 digits
    phone: str


# ---------------- Cart ---------------- #
class CartItemIn(BaseModel):
    product_id: str
    qty: int


class CartItem(BaseModel):
    product_id: str
    name: str
    image: str
    price: float
    mrp: float
    qty: int


# ---------------- Orders ---------------- #
class CreateOrderIn(BaseModel):
    address: Address
    payment_method: str  # "cod" | "upi_qr"
    coupon_code: Optional[str] = None
    delivery_slot: str = "express"  # 10-30 min default


class UPIProofIn(BaseModel):
    utr: str
    proof_image_url: str


# ---------------- Admin ---------------- #
class PincodeIn(BaseModel):
    pincode: str
    city: str = ""
    delivery_fee: float = 20
    min_order_value: float = 99
    eta_minutes: int = 12
    active: bool = True


class QRCodeIn(BaseModel):
    label: str
    upi_id: str
    image_url: str
    scope: str = "global"  # global | pincode
    pincode: Optional[str] = None
    active: bool = True


class PaymentVerifyIn(BaseModel):
    status: str  # "verified" | "rejected"
    reason: Optional[str] = None
