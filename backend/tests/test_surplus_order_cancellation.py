
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import select

from app.models.inventory_movement import InventoryMovement
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.outbox_event import OutboxEvent
from app.models.surplus_listing import SurplusListing
from app.services.order_service import accept_order, cancel_order
from fastapi import HTTPException
import pytest


def test_accepted_surplus_order_cancellation_restores_inventory(
    db_session,
    order_scenario,
):
    grower = order_scenario["grower"]
    florist = order_scenario["florist"]
    flower = order_scenario["flower"]
    batch = order_scenario["batch"]
    balance = order_scenario["balance"]

    # 1. Create an active surplus listing.
    listing = SurplusListing(
        batch_id=batch.id,
        grower_organization_id=grower.id,
        listed_quantity=10,
        remaining_quantity=9,
        price_per_unit=Decimal("10.00"),
        status="ACTIVE",
        expires_at=datetime.now(timezone.utc)
        + timedelta(days=2),
    )

    db_session.add(listing)
    db_session.flush()

    # 2. Simulate an existing surplus purchase of 1 stem.
    # The purchase has already reduced remaining_quantity.
    order = Order(
        buyer_organization_id=florist.id,
        seller_organization_id=grower.id,
        status="PENDING",
    )

    db_session.add(order)
    db_session.flush()

    order_item = OrderItem(
        order_id=order.id,
        flower_id=flower.id,
        quantity=1,
        unit_price=Decimal("10.00"),
        surplus_listing_id=listing.id,
    )

    db_session.add(order_item)
    db_session.commit()

    # 3. Accept the order and reserve inventory.
    accepted = accept_order(db_session, order.id)

    assert accepted["status"] == "ACCEPTED"

    db_session.refresh(balance)
    db_session.refresh(listing)

    assert balance.available_quantity == 299
    assert balance.reserved_quantity == 1
    assert listing.remaining_quantity == 9

    # 4. Cancel the accepted order.
    cancelled = cancel_order(db_session, order.id)

    assert cancelled["status"] == "CANCELLED"

    # 5. Verify order and listing are restored.
    db_session.refresh(order)
    db_session.refresh(listing)
    db_session.refresh(balance)

    assert order.status == "CANCELLED"
    assert listing.status == "ACTIVE"
    assert listing.remaining_quantity == 10
    assert listing.listed_quantity == 10

    # 6. Verify reserved inventory was released.
    assert balance.available_quantity == 300
    assert balance.reserved_quantity == 0

    # 7. Verify release movement was recorded.
    releases = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RELEASE",
            InventoryMovement.reference_id == order_item.id,
        )
    ).all()

    assert len(releases) == 1
    assert releases[0].quantity == 1

    # 8. Verify cancellation event was created.
    events = db_session.scalars(
        select(OutboxEvent).where(
            OutboxEvent.aggregate_id == order.id
        )
    ).all()

    event_types = [event.event_type for event in events]

    assert event_types.count("OrderAccepted") == 1
    assert event_types.count("OrderCancelled") == 1


    # 9. A second cancellation must fail without changing inventory.
    with pytest.raises(HTTPException) as exc_info:
        cancel_order(db_session, order.id)

    assert exc_info.value.status_code == 409

    db_session.refresh(balance)
    db_session.refresh(listing)

    assert balance.available_quantity == 300
    assert balance.reserved_quantity == 0
    assert listing.remaining_quantity == 10