from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from models import Deal, Company, Contact
from schemas import DealCreate, DealUpdate, DealResponse

router = APIRouter(prefix="/api/deals", tags=["Deals"])


def _enrich_deal(deal: Deal) -> DealResponse:
    data = DealResponse.model_validate(deal)
    data.company_name = deal.company.name if deal.company else None
    data.contact_name = deal.contact.name if deal.contact else None
    return data


@router.get("", response_model=list[DealResponse])
async def list_deals(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deal)
        .options(selectinload(Deal.company), selectinload(Deal.contact))
        .order_by(Deal.created_at.desc())
    )
    deals = result.scalars().all()
    return [_enrich_deal(d) for d in deals]


@router.post("", response_model=DealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(data: DealCreate, db: AsyncSession = Depends(get_db)):
    deal = Deal(**data.model_dump())
    db.add(deal)
    await db.flush()
    result = await db.execute(
        select(Deal).where(Deal.id == deal.id)
        .options(selectinload(Deal.company), selectinload(Deal.contact))
    )
    deal = result.scalar_one()
    return _enrich_deal(deal)


@router.get("/{deal_id}", response_model=DealResponse)
async def get_deal(deal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id)
        .options(selectinload(Deal.company), selectinload(Deal.contact))
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return _enrich_deal(deal)


@router.put("/{deal_id}", response_model=DealResponse)
async def update_deal(deal_id: int, data: DealUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id)
        .options(selectinload(Deal.company), selectinload(Deal.contact))
    )
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(deal, field, value)
    await db.flush()
    result = await db.execute(
        select(Deal).where(Deal.id == deal_id)
        .options(selectinload(Deal.company), selectinload(Deal.contact))
    )
    deal = result.scalar_one()
    return _enrich_deal(deal)


@router.delete("/{deal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deal(deal_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Deal).where(Deal.id == deal_id))
    deal = result.scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    await db.delete(deal)
