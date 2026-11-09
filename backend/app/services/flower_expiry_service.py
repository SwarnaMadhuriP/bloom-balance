
from datetime import date, datetime, timezone

from sqlalchemy import select, or_, update
from sqlalchemy.orm import Session

from app.models.flower_batch import FlowerBatch
from app.models.inventory_balance import InventoryBalance
from app.models.surplus_listing import SurplusListing


def get_expired_batches(db: Session):
    """
    Retrieve expired flower batches that still have
    available or reserved inventory.
    """
    today = date.today()

    stmt = (
        select(
            FlowerBatch.id,
            FlowerBatch.flower_id,
            FlowerBatch.grower_organization_id,
            FlowerBatch.expiry_date,
            InventoryBalance.location_id,
            InventoryBalance.available_quantity,
            InventoryBalance.reserved_quantity,
        )
        .join(
            InventoryBalance,
            InventoryBalance.batch_id == FlowerBatch.id,
        )
        .where(
            FlowerBatch.expiry_date < today,
            or_(
                InventoryBalance.available_quantity > 0,
                InventoryBalance.reserved_quantity > 0,
            ),
        )
        .order_by(FlowerBatch.expiry_date)
    )

    rows = db.execute(stmt).all()

    return [
        {
            "batch_id": row.id,
            "flower_id": row.flower_id,
            "organization_id": row.grower_organization_id,
            "expiry_date": row.expiry_date,
            "location_id": row.location_id,
            "available_quantity": row.available_quantity,
            "reserved_quantity": row.reserved_quantity,
        }
        for row in rows
    ]


def expire_surplus_listings(db: Session):
    """
    Mark ACTIVE surplus listings as EXPIRED when
    the associated flower batch has expired or
    the listing's own expiry time has passed.
    """
    today = date.today()
    now = datetime.now(timezone.utc)

    expired_listing_ids = (
        select(SurplusListing.id)
        .join(
            FlowerBatch,
            SurplusListing.batch_id == FlowerBatch.id,
        )
        .where(
            SurplusListing.status == "ACTIVE",
            or_(
                FlowerBatch.expiry_date < today,
                SurplusListing.expires_at <= now,
            ),
        )
    )

    try:
        result = db.execute(
            update(SurplusListing)
            .where(
                SurplusListing.id.in_(expired_listing_ids)
            )
            .values(status="EXPIRED")
            .execution_options(
                synchronize_session=False
            )
        )

        db.commit()

        return {
            "expired_listings": result.rowcount
        }

    except Exception:
        db.rollback()
        raise
