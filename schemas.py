from datetime import datetime
from decimal import Decimal
import re
from typing import Annotated

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StringConstraints


def normalize_phone_input(value: str) -> str:
    return re.sub(r"[\s-]", "", value)


IndianPhone = Annotated[
    str,
    BeforeValidator(normalize_phone_input),
    StringConstraints(pattern=r"^(?:\+91)?[6-9]\d{9}$"),
]


class CustomerCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: IndianPhone
    email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: Annotated[str, StringConstraints(pattern=r"^\d{6}$", strip_whitespace=True)] | None = None
    preferred_brand: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class CustomerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: IndianPhone | None = None
    email: str | None = Field(default=None, max_length=255)
    address: str | None = Field(default=None, max_length=1000)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: Annotated[str, StringConstraints(pattern=r"^\d{6}$", strip_whitespace=True)] | None = None
    preferred_brand: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)


class CustomerResponse(BaseModel):
    id: int
    name: str
    phone: str
    email: str | None
    address: str | None
    city: str | None
    state: str | None
    pincode: str | None
    preferred_brand: str | None
    notes: str | None
    created_at: datetime
    sale_count: int = 0
    lifetime_value: Decimal = Decimal("0.00")

    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    brand: str = Field(min_length=1, max_length=80)
    name: str = Field(min_length=1, max_length=160)
    category: str = Field(default="Android", min_length=1, max_length=40)
    description: str = Field(default="", max_length=3000)
    price: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    original_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    storage: str = Field(default="8 GB / 128 GB", max_length=40)
    colour: str = Field(default="Black", max_length=40)
    colour_hex: str = Field(default="#454545", pattern=r"^#[\da-fA-F]{6}$")
    display: str = Field(default="—", max_length=100)
    camera: str = Field(default="—", max_length=100)
    battery: str = Field(default="—", max_length=60)
    rating: Decimal = Field(default=Decimal("4.5"), ge=0, le=5, max_digits=2, decimal_places=1)
    review_count: int = Field(default=0, ge=0)
    stock: int = Field(default=0, ge=0)
    badge: str | None = Field(default=None, max_length=40)
    featured: bool = False


class ProductUpdate(BaseModel):
    brand: str | None = Field(default=None, min_length=1, max_length=80)
    name: str | None = Field(default=None, min_length=1, max_length=160)
    category: str | None = Field(default=None, min_length=1, max_length=40)
    description: str | None = Field(default=None, max_length=3000)
    price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    original_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    storage: str | None = Field(default=None, max_length=40)
    colour: str | None = Field(default=None, max_length=40)
    colour_hex: str | None = Field(default=None, pattern=r"^#[\da-fA-F]{6}$")
    display: str | None = Field(default=None, max_length=100)
    camera: str | None = Field(default=None, max_length=100)
    battery: str | None = Field(default=None, max_length=60)
    rating: Decimal | None = Field(default=None, ge=0, le=5, max_digits=2, decimal_places=1)
    review_count: int | None = Field(default=None, ge=0)
    stock: int | None = Field(default=None, ge=0)
    badge: str | None = Field(default=None, max_length=40)
    featured: bool | None = None


class ProductResponse(ProductCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SaleCreate(BaseModel):
    customer_id: int = Field(gt=0)
    product_id: int = Field(gt=0)
    quantity: int = Field(ge=1, le=100)
    unit_price: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    payment_method: str = Field(pattern=r"^(Cash|UPI|Card|EMI|Bank transfer|Other)$")
    sold_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class SaleResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_phone: str
    product_id: int
    product_name: str
    quantity: int
    unit_price: Decimal
    total: Decimal
    payment_method: str
    status: str
    sold_at: datetime
    notes: str | None


class FollowUpCreate(BaseModel):
    customer_id: int = Field(gt=0)
    activity_type: str = Field(pattern=r"^(Call|WhatsApp|Visit|Email|Note)$")
    subject: str = Field(min_length=2, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    due_at: datetime


class FollowUpUpdate(BaseModel):
    activity_type: str | None = Field(default=None, pattern=r"^(Call|WhatsApp|Visit|Email|Note)$")
    subject: str | None = Field(default=None, min_length=2, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    due_at: datetime | None = None
    status: str | None = Field(default=None, pattern=r"^(Pending|Completed|Cancelled)$")


class FollowUpResponse(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    customer_phone: str
    activity_type: str
    subject: str
    notes: str | None
    due_at: datetime
    status: str
    created_at: datetime


class DashboardResponse(BaseModel):
    total_customers: int
    sales_this_month: int
    revenue_this_month: Decimal
    inventory_units: int
    low_stock_items: int
    pending_follow_ups: int
    recent_sales: list[SaleResponse]
    upcoming_follow_ups: list[FollowUpResponse]
