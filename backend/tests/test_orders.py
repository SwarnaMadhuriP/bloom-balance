
import uuid
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlalchemy import select

from app.models.flower_batch import FlowerBatch
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_movement import InventoryMovement
from app.models.order import Order
from app.models.order_allocation import OrderAllocation
from app.models.order_item import OrderItem
from app.models.outbox_event import OutboxEvent


@pytest.mark.parametrize(
    "action",
    ["accept", "deliver", "cancel", "dispatch", "prepare"],
)
def test_nonexistent_order_returns_404(client, action):
    response = client.post(
        f"/orders/{uuid.uuid4()}/{action}"
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "Order not found"


def create_test_order(client, scenario, quantity):
    response = client.post(
        "/orders",
        json={
            "buyer_organization_id": str(scenario["florist"].id),
            "seller_organization_id": str(scenario["grower"].id),
            "items": [
                {
                    "flower_id": str(scenario["flower"].id),
                    "quantity": quantity,
                    "unit_price": "20.00",
                }
            ],
        },
    )

    assert response.status_code == 201, response.text
    return response.json()["id"]


def get_reservation_records(db_session, order_id):
    return db_session.scalars(
        select(OrderAllocation)
        .join(
            OrderItem,
            OrderAllocation.order_item_id == OrderItem.id,
        )
        .where(
            OrderItem.order_id == uuid.UUID(str(order_id))
        )
    ).all()


def get_outbox_events(db_session, order_id):
    return db_session.scalars(
        select(OutboxEvent).where(
            OutboxEvent.aggregate_id == uuid.UUID(str(order_id))
        )
    ).all()


def test_accept_order_reserves_inventory(
    client, db_session, order_scenario
):
    order_id = create_test_order(
        client, order_scenario, quantity=100
    )

    response = client.post(f"/orders/{order_id}/accept")

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ACCEPTED"

    balance = order_scenario["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 200
    assert balance.reserved_quantity == 100

    allocations = get_reservation_records(db_session, order_id)

    assert len(allocations) == 1
    assert allocations[0].quantity == 100
    assert allocations[0].batch_id == order_scenario["batch"].id

    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RESERVATION"
        )
    ).all()

    assert len(movements) == 1
    assert movements[0].quantity == 100

    events = get_outbox_events(db_session, order_id)

    assert len(events) == 1

    event = events[0]

    assert event.event_type == "OrderAccepted"
    assert event.aggregate_id == uuid.UUID(order_id)
    assert event.status == "PENDING"
    assert event.published_at is None
    assert event.payload["event_type"] == "OrderAccepted"
    assert event.payload["order_id"] == order_id
    assert event.payload["seller_organization_id"] == str(
        order_scenario["grower"].id
    )


def test_insufficient_inventory_rolls_back(
    client, db_session, order_scenario
):
    order_id = create_test_order(
        client, order_scenario, quantity=400
    )

    response = client.post(f"/orders/{order_id}/accept")

    assert response.status_code == 409
    assert (
        "Insufficient uncommitted inventory"
        in response.json()["detail"]
    )

    order = db_session.get(Order, uuid.UUID(order_id))
    db_session.refresh(order)

    assert order.status == "PENDING"

    balance = order_scenario["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 300
    assert balance.reserved_quantity == 0

    allocations = get_reservation_records(db_session, order_id)
    assert len(allocations) == 0

    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RESERVATION"
        )
    ).all()

    assert len(movements) == 0

    events = get_outbox_events(db_session, order_id)
    assert len(events) == 0


def test_duplicate_acceptance_does_not_reserve_twice(
    client, db_session, order_scenario
):
    order_id = create_test_order(
        client, order_scenario, quantity=100
    )

    first_response = client.post(f"/orders/{order_id}/accept")
    assert first_response.status_code == 200

    second_response = client.post(f"/orders/{order_id}/accept")
    assert second_response.status_code == 409

    balance = order_scenario["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 200
    assert balance.reserved_quantity == 100

    allocations = get_reservation_records(db_session, order_id)

    assert len(allocations) == 1
    assert allocations[0].quantity == 100

    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RESERVATION"
        )
    ).all()

    assert len(movements) == 1
    assert movements[0].quantity == 100

    events = get_outbox_events(db_session, order_id)

    assert len(events) == 1
    assert events[0].event_type == "OrderAccepted"


def test_fefo_allocates_earliest_expiring_batch_first(
    client, db_session, order_scenario
):
    scenario = order_scenario
    later_batch = scenario["batch"]

    earlier_batch = FlowerBatch(
        flower_id=scenario["flower"].id,
        grower_organization_id=scenario["grower"].id,
        harvest_date=date.today(),
        expiry_date=date.today() + timedelta(days=3),
        initial_quantity=50,
        price_per_unit=Decimal("15.00"),
    )

    db_session.add(earlier_batch)
    db_session.flush()

    earlier_balance = InventoryBalance(
        batch_id=earlier_batch.id,
        location_id=scenario["location"].id,
        available_quantity=50,
        reserved_quantity=0,
    )

    db_session.add(earlier_balance)
    db_session.commit()

    order_id = create_test_order(
        client, scenario, quantity=100
    )

    response = client.post(f"/orders/{order_id}/accept")

    assert response.status_code == 200, response.text

    allocations = get_reservation_records(db_session, order_id)

    allocation_by_batch = {
        allocation.batch_id: allocation.quantity
        for allocation in allocations
    }

    assert len(allocations) == 2
    assert allocation_by_batch == {
        earlier_batch.id: 50,
        later_batch.id: 50,
    }

    db_session.refresh(earlier_balance)
    db_session.refresh(scenario["balance"])

    assert earlier_balance.available_quantity == 0
    assert earlier_balance.reserved_quantity == 50
    assert scenario["balance"].available_quantity == 250
    assert scenario["balance"].reserved_quantity == 50


def test_expired_inventory_is_excluded_from_order_acceptance(
    client, db_session, order_scenario
):
    scenario = order_scenario
    valid_balance = scenario["balance"]

    expired_batch = FlowerBatch(
        flower_id=scenario["flower"].id,
        grower_organization_id=scenario["grower"].id,
        harvest_date=date.today() - timedelta(days=10),
        expiry_date=date.today() - timedelta(days=1),
        initial_quantity=200,
        price_per_unit=Decimal("15.00"),
    )

    db_session.add(expired_batch)
    db_session.flush()

    expired_balance = InventoryBalance(
        batch_id=expired_batch.id,
        location_id=scenario["location"].id,
        available_quantity=200,
        reserved_quantity=0,
    )

    db_session.add(expired_balance)
    db_session.commit()

    order_id = create_test_order(
        client, scenario, quantity=350
    )

    response = client.post(f"/orders/{order_id}/accept")

    assert response.status_code == 409
    assert (
        "Insufficient uncommitted inventory"
        in response.json()["detail"]
    )

    order = db_session.get(Order, uuid.UUID(order_id))
    db_session.refresh(order)

    assert order.status == "PENDING"

    db_session.refresh(valid_balance)
    db_session.refresh(expired_balance)

    assert valid_balance.available_quantity == 300
    assert valid_balance.reserved_quantity == 0
    assert expired_balance.available_quantity == 200
    assert expired_balance.reserved_quantity == 0

    allocations = get_reservation_records(db_session, order_id)
    assert len(allocations) == 0

    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RESERVATION"
        )
    ).all()

    assert len(movements) == 0

    events = get_outbox_events(db_session, order_id)
    assert len(events) == 0
