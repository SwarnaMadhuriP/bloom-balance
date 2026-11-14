
import uuid

from sqlalchemy import select

from app.models.order import Order
from app.models.outbox_event import OutboxEvent
from app.models.inventory_movement import InventoryMovement


def create_order(client, scenario, quantity=100):
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


def test_complete_order_lifecycle(client, db_session, order_scenario):
    order_id = create_order(client, order_scenario)
    order_uuid = uuid.UUID(order_id)
    balance = order_scenario["balance"]

    transitions = [
        ("accept", "ACCEPTED"),
        ("prepare", "PREPARING"),
        ("dispatch", "DISPATCHED"),
        ("deliver", "DELIVERED"),
    ]

    for action, expected_status in transitions:
        response = client.post(f"/orders/{order_id}/{action}")

        assert response.status_code == 200, response.text
        assert response.json()["status"] == expected_status

        db_session.expire_all()
        order = db_session.get(Order, order_uuid)
        assert order.status == expected_status

        if expected_status == "ACCEPTED":
            db_session.refresh(balance)
            assert balance.available_quantity == 200
            assert balance.reserved_quantity == 100

        if expected_status == "DISPATCHED":
            db_session.refresh(balance)
            assert balance.available_quantity == 200
            assert balance.reserved_quantity == 0

    db_session.refresh(balance)

    assert balance.available_quantity == 200
    assert balance.reserved_quantity == 0

    events = db_session.scalars(
        select(OutboxEvent)
        .where(OutboxEvent.aggregate_id == order_uuid)
    ).all()

    assert {event.event_type for event in events} == {
        "OrderAccepted",
        "OrderPreparing",
        "OrderDispatched",
        "OrderDelivered",
    }
    assert len(events) == 4

    movements = db_session.scalars(
        select(InventoryMovement)
        .where(
            InventoryMovement.batch_id == order_scenario["batch"].id
        )
    ).all()

    movement_quantities = {
        movement.movement_type: movement.quantity
        for movement in movements
    }

    assert movement_quantities == {
        "RESERVATION": 100,
        "DISPATCH": 100,
    }


def test_invalid_order_transitions(client, db_session, order_scenario):
    order_id = create_order(client, order_scenario)
    order_uuid = uuid.UUID(order_id)
    balance = order_scenario["balance"]

    for action in ("prepare", "dispatch", "deliver"):
        response = client.post(f"/orders/{order_id}/{action}")
        assert response.status_code == 409

    response = client.post(f"/orders/{order_id}/accept")
    assert response.status_code == 200

    response = client.post(f"/orders/{order_id}/dispatch")
    assert response.status_code == 409

    response = client.post(f"/orders/{order_id}/cancel")
    assert response.status_code == 200
    assert response.json()["status"] == "CANCELLED"

    for action in (
        "accept",
        "prepare",
        "dispatch",
        "deliver",
        "cancel",
    ):
        response = client.post(f"/orders/{order_id}/{action}")
        assert response.status_code == 409

    db_session.expire_all()

    order = db_session.get(Order, order_uuid)
    assert order.status == "CANCELLED"

    db_session.refresh(balance)
    assert balance.available_quantity == 300
    assert balance.reserved_quantity == 0

    events = db_session.scalars(
        select(OutboxEvent)
        .where(OutboxEvent.aggregate_id == order_uuid)
    ).all()

    assert len(events) == 2
    assert {event.event_type for event in events} == {
        "OrderAccepted",
        "OrderCancelled",
    }
