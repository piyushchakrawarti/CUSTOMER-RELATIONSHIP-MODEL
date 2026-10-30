from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from contextlib import asynccontextmanager
from decimal import Decimal

from database import init_db, AsyncSessionLocal
from models import Company, Contact, Deal, Interaction, DealStage
from schemas import DashboardStats, InteractionResponse
from routers import companies, contacts, deals, interactions


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="CRM API",
    description="Customer Relationship Management REST API",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files & templates
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# Include routers
app.include_router(companies.router)
app.include_router(contacts.router)
app.include_router(deals.router)
app.include_router(interactions.router)


# ─── Dashboard Endpoint ────────────────────────────────────────────────────────

@app.get("/api/dashboard/stats", response_model=DashboardStats)
async def dashboard_stats():
    async with AsyncSessionLocal() as db:
        # Total companies
        total_companies = (await db.execute(
            select(func.count(Company.id))
        )).scalar_one()

        # Total contacts
        total_contacts = (await db.execute(
            select(func.count(Contact.id))
        )).scalar_one()

        # Active deals (not closed-won or closed-lost)
        active_deals = (await db.execute(
            select(func.count(Deal.id)).where(
                Deal.stage.not_in([DealStage.closed_won, DealStage.closed_lost])
            )
        )).scalar_one()

        # Total revenue (sum of Closed-Won deal values)
        revenue_result = (await db.execute(
            select(func.sum(Deal.value)).where(Deal.stage == DealStage.closed_won)
        )).scalar_one()
        total_revenue = Decimal(revenue_result) if revenue_result else Decimal("0")

        # Recent interactions (last 10)
        recent_result = await db.execute(
            select(Interaction)
            .options(
                selectinload(Interaction.contact),
                selectinload(Interaction.company),
                selectinload(Interaction.deal),
            )
            .order_by(Interaction.interaction_date.desc())
            .limit(10)
        )
        recent_list = recent_result.scalars().all()
        recent_interactions = []
        for i in recent_list:
            resp = InteractionResponse.model_validate(i)
            resp.contact_name = i.contact.name if i.contact else None
            resp.company_name = i.company.name if i.company else None
            resp.deal_title = i.deal.title if i.deal else None
            recent_interactions.append(resp)

    return DashboardStats(
        total_companies=total_companies,
        total_contacts=total_contacts,
        active_deals=active_deals,
        total_revenue=total_revenue,
        recent_interactions=recent_interactions,
    )


# ─── Frontend Route ────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
