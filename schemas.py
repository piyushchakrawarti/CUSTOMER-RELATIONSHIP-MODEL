from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr, field_validator
from models import DealStage, InteractionType


# ─── Company Schemas ───────────────────────────────────────────────────────────

class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None


class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── Contact Schemas ───────────────────────────────────────────────────────────

class ContactBase(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[int] = None


class ContactCreate(ContactBase):
    pass


class ContactUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[int] = None


class ContactResponse(ContactBase):
    id: int
    created_at: datetime
    company_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Deal Schemas ──────────────────────────────────────────────────────────────

class DealBase(BaseModel):
    title: str
    value: Optional[Decimal] = None
    stage: DealStage = DealStage.lead
    close_date: Optional[date] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None


class DealCreate(DealBase):
    pass


class DealUpdate(BaseModel):
    title: Optional[str] = None
    value: Optional[Decimal] = None
    stage: Optional[DealStage] = None
    close_date: Optional[date] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None


class DealResponse(DealBase):
    id: int
    created_at: datetime
    company_name: Optional[str] = None
    contact_name: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Interaction Schemas ───────────────────────────────────────────────────────

class InteractionBase(BaseModel):
    type: InteractionType = InteractionType.note
    notes: Optional[str] = None
    interaction_date: Optional[datetime] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    deal_id: Optional[int] = None


class InteractionCreate(InteractionBase):
    pass


class InteractionUpdate(BaseModel):
    type: Optional[InteractionType] = None
    notes: Optional[str] = None
    interaction_date: Optional[datetime] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    deal_id: Optional[int] = None


class InteractionResponse(InteractionBase):
    id: int
    created_at: datetime
    contact_name: Optional[str] = None
    company_name: Optional[str] = None
    deal_title: Optional[str] = None

    model_config = {"from_attributes": True}


# ─── Dashboard Schema ──────────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_companies: int
    total_contacts: int
    active_deals: int
    total_revenue: Decimal
    recent_interactions: list[InteractionResponse]
