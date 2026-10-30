from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from models import Contact, Company
from schemas import ContactCreate, ContactUpdate, ContactResponse

router = APIRouter(prefix="/api/contacts", tags=["Contacts"])


def _enrich_contact(contact: Contact) -> ContactResponse:
    data = ContactResponse.model_validate(contact)
    data.company_name = contact.company.name if contact.company else None
    return data


@router.get("", response_model=list[ContactResponse])
async def list_contacts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contact)
        .options(selectinload(Contact.company))
        .order_by(Contact.created_at.desc())
    )
    contacts = result.scalars().all()
    return [_enrich_contact(c) for c in contacts]


@router.post("", response_model=ContactResponse, status_code=status.HTTP_201_CREATED)
async def create_contact(data: ContactCreate, db: AsyncSession = Depends(get_db)):
    contact = Contact(**data.model_dump())
    db.add(contact)
    await db.flush()
    await db.refresh(contact)
    # reload with company
    result = await db.execute(
        select(Contact).where(Contact.id == contact.id).options(selectinload(Contact.company))
    )
    contact = result.scalar_one()
    return _enrich_contact(contact)


@router.get("/{contact_id}", response_model=ContactResponse)
async def get_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id).options(selectinload(Contact.company))
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return _enrich_contact(contact)


@router.put("/{contact_id}", response_model=ContactResponse)
async def update_contact(contact_id: int, data: ContactUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id).options(selectinload(Contact.company))
    )
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.flush()
    # reload with company
    result = await db.execute(
        select(Contact).where(Contact.id == contact_id).options(selectinload(Contact.company))
    )
    contact = result.scalar_one()
    return _enrich_contact(contact)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Contact).where(Contact.id == contact_id))
    contact = result.scalar_one_or_none()
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
