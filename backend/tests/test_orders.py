
import uuid

import pytest
from sqlalchemy import select

from app.models.order import Order
from app.models.order_allocation import OrderAllocation
from app.models.inventory_movement import InventoryMovement
from app.models.order_item import OrderItem


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
            "buyer_organization_id": str(
                scenario["florist"].id
            ),
            "seller_organization_id": str(
                scenario["grower"].id
            ),
            "items": [
                {
                    "flower_id": str(
                        scenario["flower"].id
                    ),
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
        .where(OrderItem.order_id == uuid.UUID(str(order_id)))
    ).all()


def test_accept_order_reserves_inventory(
    client, db_session, order_scenario
):
    order_id = create_test_order(
        client, order_scenario, quantity=100
    )

    response = client.post(
        f"/orders/{order_id}/accept"
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "ACCEPTED"

    balance = order_scenario["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 200
    assert balance.reserved_quantity == 100

    allocations = get_reservation_records(
        db_session, order_id
    )

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


def test_insufficient_inventory_rolls_back(
    client, db_session, order_scenario
):
    # Request more roses than available.
    order_id = create_test_order(
        client, order_scenario, quantity=400
    )

    response = client.post(
        f"/orders/{order_id}/accept"
    )

    assert response.status_code == 409
    assert "Insufficient inventory" in response.json()["detail"]

    # Order must remain PENDING.
    order = db_session.get(Order, uuid.UUID(order_id))
    db_session.refresh(order)

    assert order.status == "PENDING"

    # Inventory must remain unchanged.
    balance = order_scenario["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 300
    assert balance.reserved_quantity == 0

    # No allocations should have been committed.
    allocations = get_reservation_records(
        db_session, order_id
    )

    assert len(allocations) == 0

    # No reservation movements should exist.
    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RESERVATION"
        )
    ).all()

    assert len(movements) == 0


def test_duplicate_acceptance_does_not_reserve_twice(
    client, db_session, order_scenario
):
    order_id = create_test_order(
        client, order_scenario, quantity=100
    )

    # First acceptance succeeds.
    first_response = client.post(
        f"/orders/{order_id}/accept"
    )

    assert first_response.status_code == 200

    # Second acceptance must fail.
    second_response = client.post(
        f"/orders/{order_id}/accept"
    )

    assert second_response.status_code == 409

    # Verify inventory was reserved only once.
    balance = order_scenario["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 200
    assert balance.reserved_quantity == 100

    # Exactly one allocation.
    allocations = get_reservation_records(
        db_session, order_id
    )

    assert len(allocations) == 1
    assert allocations[0].quantity == 100

    # Exactly one reservation movement.
    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.movement_type == "RESERVATION"
        )
    ).all()

    assert len(movements) == 1
    assert movements[0].quantity == 100
