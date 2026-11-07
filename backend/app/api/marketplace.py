
import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.marketplace import MarketplaceResponse
from app.services.marketplace_service import (
    list_marketplace_flowers,
)


router = APIRouter(
    prefix="/marketplace",
    tags=["Marketplace"],
)


@router.get(
    "/flowers",
    response_model=MarketplaceResponse,
)
def get_marketplace_flowers(
    search: str | None = None,
    color: str | None = None,
    grower_id: uuid.UUID | None = None,
    min_quantity: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    return list_marketplace_flowers(
        db=db,
        search=search,
        color=color,
        grower_id=grower_id,
        min_quantity=min_quantity,
        limit=limit,
        offset=offset,
    )
