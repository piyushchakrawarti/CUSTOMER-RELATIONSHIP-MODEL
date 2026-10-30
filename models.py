from datetime import datetime, date
from decimal import Decimal
from typing import Optional
from sqlalchemy import (
    Integer, String, Text, DateTime, Date, Enum, DECIMAL,
    ForeignKey, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from database import Base
import enum


class DealStage(str, enum.Enum):
    lead = "Lead"
    contacted = "Contacted"
    proposal = "Proposal"
    closed_won = "Closed-Won"
    closed_lost = "Closed-Lost"


class InteractionType(str, enum.Enum):
    call = "call"
    email = "email"
    meeting = "meeting"
    note = "note"


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    industry: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    contacts: Mapped[list["Contact"]] = relationship("Contact", back_populates="company", cascade="all, delete-orphan")
    deals: Mapped[list["Deal"]] = relationship("Deal", back_populates="company", cascade="all, delete-orphan")
    interactions: Mapped[list["Interaction"]] = relationship("Interaction", back_populates="company", cascade="all, delete-orphan")


class Contact(Base):
    __tablename__ = "contacts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="contacts")
    deals: Mapped[list["Deal"]] = relationship("Deal", back_populates="contact")
    interactions: Mapped[list["Interaction"]] = relationship("Interaction", back_populates="contact", cascade="all, delete-orphan")


class Deal(Base):
    __tablename__ = "deals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    contact_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    value: Mapped[Optional[Decimal]] = mapped_column(DECIMAL(12, 2), nullable=True)
    stage: Mapped[DealStage] = mapped_column(
        Enum(DealStage), nullable=False, default=DealStage.lead
    )
    close_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="deals")
    contact: Mapped[Optional["Contact"]] = relationship("Contact", back_populates="deals")
    interactions: Mapped[list["Interaction"]] = relationship("Interaction", back_populates="deal", cascade="all, delete-orphan")


class Interaction(Base):
    __tablename__ = "interactions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    contact_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True)
    company_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), nullable=True)
    deal_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("deals.id", ondelete="SET NULL"), nullable=True)
    type: Mapped[InteractionType] = mapped_column(Enum(InteractionType), nullable=False, default=InteractionType.note)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    interaction_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # Relationships
    contact: Mapped[Optional["Contact"]] = relationship("Contact", back_populates="interactions")
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="interactions")
    deal: Mapped[Optional["Deal"]] = relationship("Deal", back_populates="interactions")
