
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.waste_record import (
    WasteRecordCreate,
    WasteRecordResponse,
)
from app.services.waste_record_service import create_waste_record


router = APIRouter(
    prefix="/waste-records",
    tags=["BloomTrace - Waste Records"],
)


@router.post(
    "",
    response_model=WasteRecordResponse,
    status_code=status.HTTP_201_CREATED,
)
def record_waste(
    request: WasteRecordCreate,
    db: Annotated[Session, Depends(get_db)],
):
    return create_waste_record(db, request)
