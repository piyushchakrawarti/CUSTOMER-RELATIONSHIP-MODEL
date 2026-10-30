from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from decimal import Decimal

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy import func, select

from auth import (
    SESSION_COOKIE,
    auth_is_configured,
    get_session_username,
)
from database import AsyncSessionLocal, init_db
from models import AdminAccount, Customer, FollowUp, Product, Sale
from routers import auth as auth_router
from routers import crm

SAMPLE_PRODUCTS = [
    {
        "brand": "OnePlus",
        "name": "Nord 5",
        "category": "Android",
        "description": "A fluid AMOLED display and flagship-inspired performance built for everyday India.",
        "price": Decimal("31999"),
        "original_price": Decimal("34999"),
        "storage": "12 GB / 256 GB",
        "colour": "Phantom Grey",
        "colour_hex": "#69717c",
        "display": "6.83-inch 1.5K AMOLED, 144 Hz",
        "camera": "50 MP Sony main camera",
        "battery": "6,800 mAh · 80 W SUPERVOOC",
        "rating": Decimal("4.6"),
        "review_count": 1842,
        "stock": 24,
        "badge": "Bestseller",
        "featured": True,
    },
    {
        "brand": "Samsung",
        "name": "Galaxy A56 5G",
        "category": "Android",
        "description": "A vivid Super AMOLED screen, dependable cameras and long-term software support.",
        "price": Decimal("41999"),
        "original_price": Decimal("44999"),
        "storage": "8 GB / 256 GB",
        "colour": "Awesome Olive",
        "colour_hex": "#7a8060",
        "display": "6.7-inch FHD+ Super AMOLED, 120 Hz",
        "camera": "50 MP triple camera with OIS",
        "battery": "5,000 mAh · 45 W fast charging",
        "rating": Decimal("4.5"),
        "review_count": 967,
        "stock": 18,
        "badge": "Great value",
        "featured": True,
    },
    {
        "brand": "Google",
        "name": "Pixel 9a",
        "category": "Android",
        "description": "Thoughtful AI features and a camera that makes everyday moments shine.",
        "price": Decimal("49999"),
        "original_price": Decimal("52999"),
        "storage": "8 GB / 256 GB",
        "colour": "Iris",
        "colour_hex": "#8f7abc",
        "display": "6.3-inch Actua pOLED, 120 Hz",
        "camera": "48 MP dual camera with Night Sight",
        "battery": "5,100 mAh · all-day battery",
        "rating": Decimal("4.7"),
        "review_count": 734,
        "stock": 11,
        "badge": "New",
        "featured": True,
    },
    {
        "brand": "Nothing",
        "name": "Phone (3a)",
        "category": "Android",
        "description": "Stand-out transparent-inspired design with a bright screen and clean software.",
        "price": Decimal("24999"),
        "original_price": Decimal("27999"),
        "storage": "8 GB / 256 GB",
        "colour": "Blue",
        "colour_hex": "#76a6cb",
        "display": "6.77-inch AMOLED, 120 Hz",
        "camera": "50 MP triple camera with 2x zoom",
        "battery": "5,000 mAh · 50 W fast charging",
        "rating": Decimal("4.4"),
        "review_count": 1251,
        "stock": 31,
        "badge": "Trending",
        "featured": True,
    },
    {
        "brand": "Apple",
        "name": "iPhone 16",
        "category": "iPhone",
        "description": "A powerful camera system, premium build and the familiar iOS experience.",
        "price": Decimal("69900"),
        "original_price": Decimal("79900"),
        "storage": "128 GB",
        "colour": "Ultramarine",
        "colour_hex": "#5077d2",
        "display": "6.1-inch Super Retina XDR OLED",
        "camera": "48 MP Fusion dual camera",
        "battery": "All-day battery · USB-C",
        "rating": Decimal("4.8"),
        "review_count": 2136,
        "stock": 9,
        "badge": "Top rated",
        "featured": True,
    },
    {
        "brand": "Redmi",
        "name": "Note 14 Pro+ 5G",
        "category": "Android",
        "description": "A sharp curved display, versatile camera and fast charging at a friendly price.",
        "price": Decimal("30999"),
        "original_price": Decimal("34999"),
        "storage": "8 GB / 256 GB",
        "colour": "Frost Blue",
        "colour_hex": "#79a9c5",
        "display": "6.67-inch 1.5K CrystalRes AMOLED, 120 Hz",
        "camera": "50 MP OIS triple camera",
        "battery": "6,200 mAh · 90 W HyperCharge",
        "rating": Decimal("4.3"),
        "review_count": 1588,
        "stock": 27,
        "badge": "Deal of the day",
        "featured": True,
    },
    {
        "brand": "Motorola",
        "name": "Edge 60 Fusion",
        "category": "Android",
        "description": "A beautifully curved pOLED display with a slim, comfortable vegan-leather finish.",
        "price": Decimal("22999"),
        "original_price": Decimal("24999"),
        "storage": "8 GB / 256 GB",
        "colour": "Amazonite",
        "colour_hex": "#3e9484",
        "display": "6.67-inch pOLED, 120 Hz",
        "camera": "50 MP Sony LYTIA camera with OIS",
        "battery": "5,500 mAh · 68 W TurboPower",
        "rating": Decimal("4.4"),
        "review_count": 672,
        "stock": 16,
        "badge": "Just launched",
        "featured": False,
    },
    {
        "brand": "Vivo",
        "name": "V50",
        "category": "Android",
        "description": "Portrait-ready cameras and a slim design made for all-day photos and video.",
        "price": Decimal("34999"),
        "original_price": Decimal("37999"),
        "storage": "8 GB / 256 GB",
        "colour": "Rose Red",
        "colour_hex": "#c76f78",
        "display": "6.77-inch FHD+ AMOLED, 120 Hz",
        "camera": "50 MP ZEISS OIS portrait camera",
        "battery": "6,000 mAh · 90 W FlashCharge",
        "rating": Decimal("4.5"),
        "review_count": 541,
        "stock": 13,
        "badge": None,
        "featured": False,
    },
]


async def seed_products():
    async with AsyncSessionLocal() as db:
        product_count = await db.scalar(select(func.count(Product.id)))
        if product_count:
            return
        db.add_all(Product(**product) for product in SAMPLE_PRODUCTS)
        await db.commit()


async def seed_crm_data():
    async with AsyncSessionLocal() as db:
        customer_count = await db.scalar(select(func.count(Customer.id)))
        if customer_count:
            return

        customers = [
            Customer(
                name="Aarav Sharma",
                phone="9876543210",
                email="aarav.sharma@example.in",
                city="Bengaluru",
                state="Karnataka",
                pincode="560038",
                preferred_brand="OnePlus",
                notes="Interested in flagship Android phones and exchange offers.",
            ),
            Customer(
                name="Priya Nair",
                phone="9876543211",
                email="priya.nair@example.in",
                city="Kochi",
                state="Kerala",
                pincode="682016",
                preferred_brand="Samsung",
                notes="Asked about extended warranty for family purchases.",
            ),
            Customer(
                name="Rohan Mehta",
                phone="9876543212",
                email="rohan.mehta@example.in",
                city="Mumbai",
                state="Maharashtra",
                pincode="400053",
                preferred_brand="Apple",
                notes="Prefers calls after 5 PM.",
            ),
            Customer(
                name="Ananya Iyer",
                phone="9876543213",
                email="ananya.iyer@example.in",
                city="Chennai",
                state="Tamil Nadu",
                pincode="600028",
                preferred_brand="Nothing",
                notes="Comparing camera quality and exchange value.",
            ),
            Customer(
                name="Kabir Singh",
                phone="9876543214",
                email="kabir.singh@example.in",
                city="Jaipur",
                state="Rajasthan",
                pincode="302017",
                preferred_brand="Redmi",
                notes="Interested in budget 5G options.",
            ),
        ]
        db.add_all(customers)
        await db.flush()

        products = {
            product.brand: product
            for product in (
                await db.execute(select(Product).order_by(Product.id))
            ).scalars()
        }
        customer_by_name = {customer.name: customer for customer in customers}
        sample_sales = [
            ("Aarav Sharma", "OnePlus", 1, 21),
            ("Priya Nair", "Samsung", 1, 18),
            ("Rohan Mehta", "Apple", 1, 13),
            ("Ananya Iyer", "Nothing", 1, 8),
            ("Kabir Singh", "Redmi", 1, 4),
        ]
        for customer_name, brand, quantity, days_ago in sample_sales:
            if brand in products:
                product = products[brand]
                db.add(
                    Sale(
                        customer_id=customer_by_name[customer_name].id,
                        product_id=product.id,
                        quantity=quantity,
                        unit_price=product.price,
                        payment_method="UPI",
                        sold_at=datetime.now() - timedelta(days=days_ago),
                        notes="Sample sale for CRM demo.",
                    )
                )

        now = datetime.now()
        db.add_all(
            [
                FollowUp(
                    customer_id=customer_by_name["Aarav Sharma"].id,
                    activity_type="WhatsApp",
                    subject="Share OnePlus accessories and protection plan",
                    due_at=now + timedelta(hours=4),
                    notes="Send the approved accessory and screen-protection options.",
                ),
                FollowUp(
                    customer_id=customer_by_name["Priya Nair"].id,
                    activity_type="Call",
                    subject="Check in after Samsung purchase",
                    due_at=now + timedelta(days=1),
                    notes="Ask if she needs help with data transfer.",
                ),
                FollowUp(
                    customer_id=customer_by_name["Ananya Iyer"].id,
                    activity_type="Visit",
                    subject="Demo Nothing Phone camera",
                    due_at=now + timedelta(days=2),
                    notes="Keep the demo unit ready.",
                ),
            ]
        )
        await db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await seed_products()
    await seed_crm_data()
    yield


app = FastAPI(
    title="TechPhones Mobile Shop CRM",
    description="Customer, sales, inventory and follow-up management for an Indian mobile retailer.",
    version="3.0.0",
    lifespan=lifespan,
)

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")
app.include_router(crm.router)
app.include_router(auth_router.router)


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.middleware("http")
async def require_admin(request: Request, call_next):
    public_paths = {
        "/login",
        "/api/auth/login",
        "/api/auth/logout",
        "/api/auth/register",
    }
    if request.url.path in public_paths or request.url.path.startswith("/static/"):
        return await call_next(request)

    username = get_session_username(request.cookies.get(SESSION_COOKIE))
    if username:
        request.state.admin_username = username
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    if request.url.path.startswith("/api/"):
        return JSONResponse({"detail": "Admin login required."}, status_code=401)
    return RedirectResponse("/login", status_code=303)


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    username = get_session_username(request.cookies.get(SESSION_COOKIE))
    if username:
        return RedirectResponse("/", status_code=303)
    async with AsyncSessionLocal() as db:
        account_exists = await db.scalar(select(AdminAccount.id).limit(1)) is not None
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "account_exists": account_exists,
        },
        headers={"Cache-Control": "no-store"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
