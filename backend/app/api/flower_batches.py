from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.models.inventory_movement import InventoryMovement
from app.schemas.flower_batch import FlowerBatchCreate, FlowerBatchResponse

router = APIRouter(prefix="/flower-batches", tags=["Flower Batches"])


@router.post("", response_model=FlowerBatchResponse, status_code=status.HTTP_201_CREATED)
def create_flower_batch(batch_data: FlowerBatchCreate, db: Annotated[Session, Depends(get_db)]):
    flower = db.get(Flower, batch_data.flower_id)
    if flower is None:
        raise HTTPException(status_code=404, detail="Flower not found")
    organization = db.get(Organization, batch_data.grower_organization_id)
    if organization is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    if organization.organization_type != "grower":
        raise HTTPException(status_code=400, detail="Only grower organizations can create flower batches")
    batch = FlowerBatch(**batch_data.model_dump())
    db.add(batch)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Unable to create flower batch due to a database constraint")
    db.refresh(batch)
    return batch


@router.get("")
def list_flower_batches(
    organization_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    received_subquery = (
        select(
            InventoryMovement.batch_id.label("batch_id"),
            func.sum(InventoryMovement.quantity).label("received_quantity"),
        )
        .where(InventoryMovement.movement_type == "HARVEST")
        .group_by(InventoryMovement.batch_id)
        .subquery()
    )
    statement = (
        select(FlowerBatch, Flower, func.coalesce(received_subquery.c.received_quantity, 0))
        .join(Flower, FlowerBatch.flower_id == Flower.id)
        .outerjoin(received_subquery, FlowerBatch.id == received_subquery.c.batch_id)
        .where(FlowerBatch.grower_organization_id == organization_id)
        .order_by(FlowerBatch.harvest_date.desc(), FlowerBatch.created_at.desc())
    )
    result = []
    for batch, flower, received in db.execute(statement):
        received = int(received)
        remaining = max(0, batch.initial_quantity - received)
        receipt_status = (
            "NOT_RECEIVED" if received == 0 else
            "FULLY_RECEIVED" if remaining == 0 else
            "PARTIALLY_RECEIVED"
        )
        result.append({
            "id": batch.id,
            "flower_id": flower.id,
            "flower_name": flower.name,
            "variety": flower.variety,
            "unit": flower.unit,
            "harvest_date": batch.harvest_date,
            "expiry_date": batch.expiry_date,
            "initial_quantity": batch.initial_quantity,
            "received_quantity": received,
            "remaining_quantity": remaining,
            "receipt_status": receipt_status,
            "price_per_unit": batch.price_per_unit,
            "created_at": batch.created_at,
        })
    return result
