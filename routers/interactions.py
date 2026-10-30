from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from database import get_db
from models import Interaction, Contact, Company, Deal
from schemas import InteractionCreate, InteractionUpdate, InteractionResponse

router = APIRouter(prefix="/api/interactions", tags=["Interactions"])


def _enrich_interaction(interaction: Interaction) -> InteractionResponse:
    data = InteractionResponse.model_validate(interaction)
    data.contact_name = interaction.contact.name if interaction.contact else None
    data.company_name = interaction.company.name if interaction.company else None
    data.deal_title = interaction.deal.title if interaction.deal else None
    return data


def _load_opts():
    return [
        selectinload(Interaction.contact),
        selectinload(Interaction.company),
        selectinload(Interaction.deal),
    ]


@router.get("", response_model=list[InteractionResponse])
async def list_interactions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Interaction).options(*_load_opts()).order_by(Interaction.interaction_date.desc())
    )
    interactions = result.scalars().all()
    return [_enrich_interaction(i) for i in interactions]


@router.post("", response_model=InteractionResponse, status_code=status.HTTP_201_CREATED)
async def create_interaction(data: InteractionCreate, db: AsyncSession = Depends(get_db)):
    interaction = Interaction(**data.model_dump())
    db.add(interaction)
    await db.flush()
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction.id).options(*_load_opts())
    )
    interaction = result.scalar_one()
    return _enrich_interaction(interaction)


@router.get("/{interaction_id}", response_model=InteractionResponse)
async def get_interaction(interaction_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id).options(*_load_opts())
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    return _enrich_interaction(interaction)


@router.put("/{interaction_id}", response_model=InteractionResponse)
async def update_interaction(interaction_id: int, data: InteractionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id).options(*_load_opts())
    )
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(interaction, field, value)
    await db.flush()
    result = await db.execute(
        select(Interaction).where(Interaction.id == interaction_id).options(*_load_opts())
    )
    interaction = result.scalar_one()
    return _enrich_interaction(interaction)


@router.delete("/{interaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_interaction(interaction_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Interaction).where(Interaction.id == interaction_id))
    interaction = result.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=404, detail="Interaction not found")
    await db.delete(interaction)
