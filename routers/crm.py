from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models import Customer, FollowUp, Product, Sale
from schemas import (
    CustomerCreate,
    CustomerResponse,
    CustomerUpdate,
    DashboardResponse,
    FollowUpCreate,
    FollowUpResponse,
    FollowUpUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SaleCreate,
    SaleResponse,
)

router = APIRouter(prefix="/api", tags=["TechPhones CRM"])


def normalized_phone(phone: str) -> str:
    digits = "".join(character for character in phone if character.isdigit())
    return digits[-10:]


async def customer_response(db: AsyncSession, customer: Customer) -> CustomerResponse:
    sale_count, lifetime_value = (
        await db.execute(
            select(
                func.count(Sale.id),
                func.coalesce(func.sum(Sale.quantity * Sale.unit_price), 0),
            ).where(Sale.customer_id == customer.id, Sale.status == "Completed")
        )
    ).one()
    return CustomerResponse(
        **{
            key: getattr(customer, key)
            for key in (
                "id", "name", "phone", "email", "address", "city", "state",
                "pincode", "preferred_brand", "notes", "created_at",
            )
        },
        sale_count=sale_count,
        lifetime_value=lifetime_value,
    )


def sale_response(sale: Sale) -> SaleResponse:
    return SaleResponse(
        id=sale.id,
        customer_id=sale.customer_id,
        customer_name=sale.customer.name,
        customer_phone=sale.customer.phone,
        product_id=sale.product_id,
        product_name=f"{sale.product.brand} {sale.product.name}",
        quantity=sale.quantity,
        unit_price=sale.unit_price,
        total=sale.quantity * sale.unit_price,
        payment_method=sale.payment_method,
        status=sale.status,
        sold_at=sale.sold_at,
        notes=sale.notes,
    )


def follow_up_response(follow_up: FollowUp) -> FollowUpResponse:
    return FollowUpResponse(
        id=follow_up.id,
        customer_id=follow_up.customer_id,
        customer_name=follow_up.customer.name,
        customer_phone=follow_up.customer.phone,
        activity_type=follow_up.activity_type,
        subject=follow_up.subject,
        notes=follow_up.notes,
        due_at=follow_up.due_at,
        status=follow_up.status,
        created_at=follow_up.created_at,
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def dashboard(db: AsyncSession = Depends(get_db)):
    now = datetime.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total_customers = await db.scalar(select(func.count(Customer.id))) or 0
    sales_this_month = await db.scalar(
        select(func.count(Sale.id)).where(
            Sale.status == "Completed", Sale.sold_at >= month_start
        )
    ) or 0
    revenue_this_month = await db.scalar(
        select(func.coalesce(func.sum(Sale.quantity * Sale.unit_price), 0)).where(
            Sale.status == "Completed", Sale.sold_at >= month_start
        )
    ) or Decimal("0")
    inventory_units = await db.scalar(select(func.coalesce(func.sum(Product.stock), 0))) or 0
    low_stock_items = await db.scalar(
        select(func.count(Product.id)).where(Product.stock <= 5)
    ) or 0
    pending_follow_ups = await db.scalar(
        select(func.count(FollowUp.id)).where(FollowUp.status == "Pending")
    ) or 0

    sales_result = await db.execute(
        select(Sale)
        .options(selectinload(Sale.customer), selectinload(Sale.product))
        .where(Sale.status == "Completed")
        .order_by(Sale.sold_at.desc())
        .limit(6)
    )
    follow_ups_result = await db.execute(
        select(FollowUp)
        .options(selectinload(FollowUp.customer))
        .where(FollowUp.status == "Pending")
        .order_by(FollowUp.due_at.asc())
        .limit(6)
    )
    return DashboardResponse(
        total_customers=total_customers,
        sales_this_month=sales_this_month,
        revenue_this_month=revenue_this_month,
        inventory_units=inventory_units,
        low_stock_items=low_stock_items,
        pending_follow_ups=pending_follow_ups,
        recent_sales=[sale_response(sale) for sale in sales_result.scalars()],
        upcoming_follow_ups=[
            follow_up_response(item) for item in follow_ups_result.scalars()
        ],
    )


@router.get("/customers", response_model=list[CustomerResponse])
async def list_customers(
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Customer).order_by(Customer.created_at.desc())
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
                Customer.email.ilike(term),
                Customer.city.ilike(term),
                Customer.preferred_brand.ilike(term),
            )
        )
    customers = (await db.execute(query)).scalars().all()
    return [await customer_response(db, customer) for customer in customers]


@router.post(
    "/customers",
    response_model=CustomerResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_customer(data: CustomerCreate, db: AsyncSession = Depends(get_db)):
    phone = normalized_phone(data.phone)
    existing = await db.scalar(select(Customer.id).where(Customer.phone == phone))
    if existing:
        raise HTTPException(status_code=409, detail="A customer with this phone number already exists.")
    customer = Customer(**data.model_dump(exclude={"phone"}), phone=phone)
    db.add(customer)
    await db.flush()
    await db.refresh(customer)
    return await customer_response(db, customer)


@router.put("/customers/{customer_id}", response_model=CustomerResponse)
async def update_customer(
    customer_id: int, data: CustomerUpdate, db: AsyncSession = Depends(get_db)
):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    updates = data.model_dump(exclude_unset=True)
    if updates.get("phone"):
        phone = normalized_phone(updates["phone"])
        duplicate = await db.scalar(
            select(Customer.id).where(Customer.phone == phone, Customer.id != customer_id)
        )
        if duplicate:
            raise HTTPException(status_code=409, detail="A customer with this phone number already exists.")
        updates["phone"] = phone
    for field, value in updates.items():
        setattr(customer, field, value)
    await db.flush()
    return await customer_response(db, customer)


@router.delete("/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_customer(customer_id: int, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    sale_exists = await db.scalar(select(Sale.id).where(Sale.customer_id == customer_id).limit(1))
    if sale_exists:
        raise HTTPException(
            status_code=409,
            detail="This customer has sales on record. Keep the profile for purchase history.",
        )
    await db.delete(customer)


@router.get("/products", response_model=list[ProductResponse])
async def list_products(
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Product).order_by(Product.brand, Product.name)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.where(
            or_(Product.name.ilike(term), Product.brand.ilike(term), Product.storage.ilike(term))
        )
    return (await db.execute(query)).scalars().all()


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(data: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(**data.model_dump())
    db.add(product)
    await db.flush()
    await db.refresh(product)
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: int, data: ProductUpdate, db: AsyncSession = Depends(get_db)
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Phone not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(product, field, value)
    await db.flush()
    await db.refresh(product)
    return product


@router.get("/sales", response_model=list[SaleResponse])
async def list_sales(
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(Sale).options(selectinload(Sale.customer), selectinload(Sale.product))
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(Sale.customer).join(Sale.product).where(
            or_(
                Customer.name.ilike(term),
                Customer.phone.ilike(term),
                Product.name.ilike(term),
                Product.brand.ilike(term),
            )
        )
    sales = (await db.execute(query.order_by(Sale.sold_at.desc()))).scalars().all()
    return [sale_response(sale) for sale in sales]


@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
async def create_sale(data: SaleCreate, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, data.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    product = await db.scalar(
        select(Product).where(Product.id == data.product_id).with_for_update()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Phone not found")
    if product.stock < data.quantity:
        raise HTTPException(
            status_code=409,
            detail=f"Only {product.stock} unit(s) of {product.brand} {product.name} are in stock.",
        )
    unit_price = data.unit_price or product.price
    product.stock -= data.quantity
    sale = Sale(
        customer_id=customer.id,
        product_id=product.id,
        quantity=data.quantity,
        unit_price=unit_price,
        payment_method=data.payment_method,
        sold_at=data.sold_at or datetime.now(),
        notes=data.notes.strip() if data.notes else None,
    )
    db.add(sale)
    await db.flush()
    result = await db.execute(
        select(Sale)
        .where(Sale.id == sale.id)
        .options(selectinload(Sale.customer), selectinload(Sale.product))
    )
    return sale_response(result.scalar_one())


@router.get("/follow-ups", response_model=list[FollowUpResponse])
async def list_follow_ups(
    status_filter: str | None = Query(default=None, alias="status", pattern="^(Pending|Completed|Cancelled)$"),
    search: str | None = Query(default=None, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    query = select(FollowUp).options(selectinload(FollowUp.customer))
    if status_filter:
        query = query.where(FollowUp.status == status_filter)
    if search and search.strip():
        term = f"%{search.strip()}%"
        query = query.join(FollowUp.customer).where(
            or_(FollowUp.subject.ilike(term), Customer.name.ilike(term), Customer.phone.ilike(term))
        )
    follow_ups = (
        await db.execute(query.order_by(FollowUp.due_at.asc(), FollowUp.id.desc()))
    ).scalars().all()
    return [follow_up_response(item) for item in follow_ups]


@router.post(
    "/follow-ups",
    response_model=FollowUpResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_follow_up(data: FollowUpCreate, db: AsyncSession = Depends(get_db)):
    customer = await db.get(Customer, data.customer_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    item = FollowUp(**data.model_dump())
    db.add(item)
    await db.flush()
    result = await db.execute(
        select(FollowUp)
        .where(FollowUp.id == item.id)
        .options(selectinload(FollowUp.customer))
    )
    return follow_up_response(result.scalar_one())


@router.put("/follow-ups/{follow_up_id}", response_model=FollowUpResponse)
async def update_follow_up(
    follow_up_id: int,
    data: FollowUpUpdate,
    db: AsyncSession = Depends(get_db),
):
    item = await db.get(FollowUp, follow_up_id)
    if not item:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.flush()
    result = await db.execute(
        select(FollowUp)
        .where(FollowUp.id == item.id)
        .options(selectinload(FollowUp.customer))
    )
    return follow_up_response(result.scalar_one())


@router.delete("/follow-ups/{follow_up_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_follow_up(follow_up_id: int, db: AsyncSession = Depends(get_db)):
    item = await db.get(FollowUp, follow_up_id)
    if not item:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    await db.delete(item)
