
import uuid
from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.surplus_listing import SurplusListing
from app.schemas.surplus_purchase import SurplusPurchaseCreate


def purchase_surplus(
    db: Session,
    listing_id: uuid.UUID,
    request: SurplusPurchaseCreate,
):
    try:
        # Lock the listing to prevent concurrent overselling.
        listing = db.scalar(
            select(SurplusListing)
            .where(SurplusListing.id == listing_id)
            .with_for_update()
        )

        if listing is None:
            raise HTTPException(404, "Surplus listing not found")

        now = datetime.now(timezone.utc)

        if (
            listing.status != "ACTIVE"
            or listing.expires_at <= now
        ):
            raise HTTPException(
                409, "Surplus listing is no longer active"
            )

        if listing.remaining_quantity < request.quantity:
            raise HTTPException(
                409, "Insufficient surplus quantity"
            )

        batch = db.get(FlowerBatch, listing.batch_id)

        if batch is None:
            raise HTTPException(404, "Flower batch not found")

        if batch.expiry_date < date.today():
            raise HTTPException(409, "Flower batch has expired")

        if batch.grower_organization_id != listing.grower_organization_id:
            raise HTTPException(409, "Invalid listing ownership")

        buyer = db.get(
            Organization, request.buyer_organization_id
        )

        if buyer is None:
            raise HTTPException(
                404, "Buyer organization not found"
            )

        if buyer.organization_type != "florist":
            raise HTTPException(
                400, "Buyer must be a florist"
            )

        if buyer.id == listing.grower_organization_id:
            raise HTTPException(
                400, "Buyer and seller must be different"
            )

        # Calculate total using the seller's listing price.
        total = listing.price_per_unit * request.quantity

        order = Order(
            buyer_organization_id=buyer.id,
            seller_organization_id=listing.grower_organization_id,
            status="PENDING",
            total_amount=total,
        )

        db.add(order)
        db.flush()

        item = OrderItem(
            order_id=order.id,
            flower_id=batch.flower_id,
            surplus_listing_id=listing.id,
            quantity=request.quantity,
            unit_price=listing.price_per_unit,
        )

        db.add(item)

        # Hold surplus capacity while order is pending.
        listing.remaining_quantity -= request.quantity

        if listing.remaining_quantity == 0:
            listing.status = "SOLD_OUT"

        db.commit()
        db.refresh(order)
        db.refresh(item)

        return {
            "order_id": str(order.id),
            "status": order.status,
            "surplus_listing_id": str(listing.id),
            "quantity": item.quantity,
            "unit_price": str(item.unit_price),
            "total_amount": str(order.total_amount),
        }

    except Exception:
        db.rollback()
        raise
