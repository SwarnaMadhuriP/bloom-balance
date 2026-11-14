
import uuid

import pytest
from sqlalchemy import select

from app.models.notification import Notification
from app.models.order import Order
from app.models.processed_event import ProcessedEvent
from app.workers import notification_consumer


@pytest.fixture
def notification_scenario(client, db_session, order_scenario, monkeypatch):
    scenario = order_scenario

    response = client.post(
        "/orders",
        json={
            "buyer_organization_id": str(scenario["florist"].id),
            "seller_organization_id": str(scenario["grower"].id),
            "items": [
                {
                    "flower_id": str(scenario["flower"].id),
                    "quantity": 10,
                    "unit_price": "20.00",
                }
            ],
        },
    )

    assert response.status_code == 201, response.text

    order_id = uuid.UUID(response.json()["id"])
    event_id = uuid.uuid4()

    monkeypatch.setattr(
        notification_consumer,
        "SessionLocal",
        lambda: db_session,
    )

    return {
        "order_id": order_id,
        "event_id": event_id,
        "buyer_id": scenario["florist"].id,
        "event": {
            "event_id": str(event_id),
            "event_type": "OrderAccepted",
            "order_id": str(order_id),
        },
    }


def get_notifications(db_session):
    return db_session.scalars(
        select(Notification)
    ).all()


def get_processed_events(db_session):
    return db_session.scalars(
        select(ProcessedEvent).where(
            ProcessedEvent.consumer_group
            == notification_consumer.GROUP_ID
        )
    ).all()


def test_order_accepted_creates_notification(
    db_session, notification_scenario
):
    notification_consumer.process_event(
        notification_scenario["event"]
    )

    notifications = get_notifications(db_session)
    processed_events = get_processed_events(db_session)

    assert len(notifications) == 1
    assert len(processed_events) == 1

    notification = notifications[0]

    assert notification.order_id == notification_scenario["order_id"]
    assert notification.organization_id == notification_scenario["buyer_id"]
    assert notification.event_id == notification_scenario["event_id"]
    assert notification.notification_type == "ORDER_ACCEPTED"
    assert notification.status == "UNREAD"

    assert processed_events[0].event_id == notification_scenario["event_id"]


def test_duplicate_event_does_not_create_duplicate_notifications(
    db_session, notification_scenario
):
    event = notification_scenario["event"]

    notification_consumer.process_event(event)
    notification_consumer.process_event(event)

    notifications = get_notifications(db_session)
    processed_events = get_processed_events(db_session)

    assert len(notifications) == 1
    assert len(processed_events) == 1


def test_unrelated_event_is_ignored(
    db_session, notification_scenario
):
    event = {
        **notification_scenario["event"],
        "event_type": "UnknownEvent",
    }

    notification_consumer.process_event(event)

    assert len(get_notifications(db_session)) == 0
    assert len(get_processed_events(db_session)) == 0


def test_missing_event_id_is_ignored(
    db_session, notification_scenario
):
    event = {
        "event_type": "OrderAccepted",
        "order_id": str(notification_scenario["order_id"]),
    }

    notification_consumer.process_event(event)

    assert len(get_notifications(db_session)) == 0
    assert len(get_processed_events(db_session)) == 0


def test_missing_order_rolls_back_processed_event(
    db_session, notification_scenario
):
    event = {
        **notification_scenario["event"],
        "order_id": str(uuid.uuid4()),
    }

    with pytest.raises(ValueError, match="does not exist"):
        notification_consumer.process_event(event)

    assert len(get_notifications(db_session)) == 0
    assert len(get_processed_events(db_session)) == 0
