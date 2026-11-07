
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.flower_batch import FlowerBatch
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_location import InventoryLocation
from app.models.surplus_listing import SurplusListing
from app.schemas.surplus_listing import SurplusListingCreate
from app.models.flower import Flower

import uuid



def create_surplus_listing(
    db: Session,
    data: SurplusListingCreate,
) -> SurplusListing:

    now = datetime.now(timezone.utc)

    # 1. Lock the batch to serialize listing creation.
    batch = db.execute(
        select(FlowerBatch)
        .where(FlowerBatch.id == data.batch_id)
        .with_for_update()
    ).scalar_one_or_none()

    if batch is None:
        raise HTTPException(404, "Flower batch not found")

    # 2. Verify the grower owns this batch.
    if batch.grower_organization_id != data.grower_organization_id:
        raise HTTPException(
            403,
            "This batch does not belong to the grower",
        )

    # 3. Validate listing expiry.
    if data.expires_at.utcoffset() is None:
        raise HTTPException(
            400,
            "expires_at must include a timezone",
        )

    if data.expires_at <= now:
        raise HTTPException(
            400,
            "Listing expiry must be in the future",
        )

    # 4. Do not list flowers beyond their batch expiry.
    if data.expires_at.date() > batch.expiry_date:
        raise HTTPException(
            400,
            "Listing cannot expire after the flower batch",
        )

    # 5. Ensure surplus price is discounted.
    if data.price_per_unit >= batch.price_per_unit:
        raise HTTPException(
            400,
            "Surplus price must be lower than batch price",
        )

    # 6. Calculate available grower inventory.
    available = db.scalar(
        select(func.coalesce(
            func.sum(InventoryBalance.available_quantity), 0
        ))
        .join(
            InventoryLocation,
            InventoryLocation.id == InventoryBalance.location_id,
        )
        .where(
            InventoryBalance.batch_id == data.batch_id,
            InventoryLocation.organization_id
            == data.grower_organization_id,
        )
    )

    # 7. Account for existing active listings.
    already_listed = db.scalar(
        select(func.coalesce(
            func.sum(SurplusListing.remaining_quantity), 0
        ))
        .where(
            SurplusListing.batch_id == data.batch_id,
            SurplusListing.status == "ACTIVE",
            SurplusListing.expires_at > now,
        )
    )

    if data.listed_quantity > available - already_listed:
        raise HTTPException(
            400,
            "Insufficient unlisted inventory",
        )

    # 8. Create the listing.
    listing = SurplusListing(
        batch_id=data.batch_id,
        grower_organization_id=data.grower_organization_id,
        listed_quantity=data.listed_quantity,
        remaining_quantity=data.listed_quantity,
        price_per_unit=data.price_per_unit,
        expires_at=data.expires_at,
        status="ACTIVE",
    )

    db.add(listing)
    db.commit()
    db.refresh(listing)

    return listing

def get_active_surplus_listings(
    db: Session,
    flower_id=None,
    grower_id=None,
    max_price=None,
):
    now = datetime.now(timezone.utc)

    stmt = (
        select(SurplusListing)
        .join(
            FlowerBatch,
            SurplusListing.batch_id == FlowerBatch.id,
        )
        .where(
            SurplusListing.status == "ACTIVE",
            SurplusListing.remaining_quantity > 0,
            SurplusListing.expires_at > now,
            FlowerBatch.expiry_date >= now.date(),
        )
        .order_by(SurplusListing.expires_at.asc())
    )

    if flower_id is not None:
        stmt = stmt.where(
            FlowerBatch.flower_id == flower_id
        )

    if grower_id is not None:
        stmt = stmt.where(
            SurplusListing.grower_organization_id == grower_id
        )

    if max_price is not None:
        stmt = stmt.where(
            SurplusListing.price_per_unit <= max_price
        )

    return db.scalars(stmt).all()

def cancel_surplus_listing(
    db: Session,
    listing_id: uuid.UUID,
    grower_organization_id: uuid.UUID,
) -> SurplusListing:

    # Lock the listing during cancellation.
    listing = db.execute(
        select(SurplusListing)
        .where(SurplusListing.id == listing_id)
        .with_for_update()
    ).scalar_one_or_none()

    if listing is None:
        raise HTTPException(
            status_code=404,
            detail="Surplus listing not found",
        )

    # Check that the grower owns the listing.
    if listing.grower_organization_id != grower_organization_id:
        raise HTTPException(
            status_code=403,
            detail="Listing does not belong to this grower",
        )

    if listing.status != "ACTIVE":
        raise HTTPException(
            status_code=409,
            detail="Only active listings can be cancelled",
        )

    listing.status = "CANCELLED"

    db.commit()
    db.refresh(listing)

    return listing

