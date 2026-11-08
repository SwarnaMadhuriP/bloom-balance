
from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.services.flower_expiry_service import (
    get_expired_batches,
)
from app.services.flower_expiry_service import expire_surplus_listings

router = APIRouter(
    prefix="/bloomtrace/expiry",
    tags=["BloomTrace - Expiry"],
)


class ExpiredBatchResponse(BaseModel):
    batch_id: UUID
    flower_id: UUID
    organization_id: UUID
    expiry_date: date
    location_id: UUID
    available_quantity: int
    reserved_quantity: int


@router.get(
    "/batches",
    response_model=list[ExpiredBatchResponse],
)
def list_expired_batches(
    db: Session = Depends(get_db),
):
    return get_expired_batches(db)



@router.post("/process-listings")
def process_expired_listings(
    db: Session = Depends(get_db),
):
    return expire_surplus_listings(db)
