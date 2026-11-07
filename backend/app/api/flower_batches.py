
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.schemas.flower_batch import (
    FlowerBatchCreate,
    FlowerBatchResponse,
)

router = APIRouter(
    prefix="/flower-batches",
    tags=["Flower Batches"],
)


@router.post(
    "",
    response_model=FlowerBatchResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_flower_batch(
    batch_data: FlowerBatchCreate,
    db: Annotated[Session, Depends(get_db)],
):
    # 1. Verify that the flower exists
    flower = db.get(Flower, batch_data.flower_id)

    if flower is None:
        raise HTTPException(
            status_code=404,
            detail="Flower not found",
        )

    # 2. Verify that the organization exists
    organization = db.get(
        Organization,
        batch_data.grower_organization_id,
    )

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    # 3. Verify that the organization is a grower
    if organization.organization_type != "grower":
        raise HTTPException(
            status_code=400,
            detail="Only grower organizations can create flower batches",
        )

    # 4. Create the batch
    batch = FlowerBatch(**batch_data.model_dump())

    db.add(batch)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Unable to create flower batch due to a database constraint",
        )

    db.refresh(batch)

    return batch
