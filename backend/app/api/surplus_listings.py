
from typing import Annotated

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.surplus_listing import (
    SurplusListingCreate,
    SurplusListingResponse,
)
from app.services.surplus_listing_service import (
    create_surplus_listing,
    get_active_surplus_listings,
    cancel_surplus_listing,
)

import uuid
from decimal import Decimal

from app.schemas.surplus_purchase import SurplusPurchaseCreate
from app.services.surplus_purchase_service import purchase_surplus

router = APIRouter(
    prefix="/surplus-listings",
    tags=["Surplus Listings"],
)




@router.post(
    "",
    response_model=SurplusListingResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_listing(
    data: SurplusListingCreate,
    db: Annotated[Session, Depends(get_db)],
):
    return create_surplus_listing(db, data)

@router.get(
    "",
    response_model=list[SurplusListingResponse],
)
def list_surplus(
    db: Annotated[Session, Depends(get_db)],
    flower_id: uuid.UUID | None = None,
    grower_id: uuid.UUID | None = None,
    max_price: Annotated[
        Decimal | None,
        Query(gt=0),
    ] = None,
):
    return get_active_surplus_listings(
        db=db,
        flower_id=flower_id,
        grower_id=grower_id,
        max_price=max_price,
    )

@router.patch(
    "/{listing_id}/cancel",
    response_model=SurplusListingResponse,
)
def cancel_listing(
    listing_id: uuid.UUID,
    grower_organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return cancel_surplus_listing(
        db=db,
        listing_id=listing_id,
        grower_organization_id=grower_organization_id,
    )



@router.post(
    "/{listing_id}/purchase",
    status_code=status.HTTP_201_CREATED,
)
def purchase_surplus_listing(
    listing_id: uuid.UUID,
    request: SurplusPurchaseCreate,
    db: Annotated[Session, Depends(get_db)],
):
    return purchase_surplus(
        db=db,
        listing_id=listing_id,
        request=request,
    )
