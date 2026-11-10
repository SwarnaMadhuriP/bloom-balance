
import uuid
from contextlib import nullcontext
from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.models.processed_event import ProcessedEvent
from app.models.waste_analytics import WasteAnalytics
from app.workers import waste_analytics_consumer
from datetime import datetime, timezone



def make_event(organization_id, event_id=None, quantity=10, unit="stem"):
    return {
        "event_id": str(event_id or uuid.uuid4()),
        "event_type": "InventoryWasteRecorded",
        "organization_id": str(organization_id),
        "quantity": quantity,
        "unit": unit,
        "occurred_at": datetime.now(timezone.utc).isoformat(),
        "reason": "EXPIRED",
    }

def test_waste_event_updates_analytics(
    db_session, monkeypatch, order_scenario
):
    # Keep the pytest-managed session open.
    monkeypatch.setattr(
        waste_analytics_consumer,
        "SessionLocal",
        lambda: nullcontext(db_session),
    )

    # Store UUID before processing to avoid detached ORM access.
    organization_id = order_scenario["grower"].id
    event = make_event(organization_id, quantity=10)

    waste_analytics_consumer.process_event(event)

    analytics = db_session.scalar(
        select(WasteAnalytics).where(
            WasteAnalytics.organization_id == organization_id,
            WasteAnalytics.waste_date == date.today(),
        )
    )

    assert analytics is not None
    assert analytics.total_quantity == 10

    processed = db_session.scalar(
        select(ProcessedEvent).where(
            ProcessedEvent.consumer_group
            == waste_analytics_consumer.GROUP_ID,
            ProcessedEvent.event_id == uuid.UUID(event["event_id"]),
        )
    )

    assert processed is not None


def test_duplicate_event_does_not_double_count(
    db_session, monkeypatch, order_scenario
):
    monkeypatch.setattr(
        waste_analytics_consumer,
        "SessionLocal",
        lambda: nullcontext(db_session),
    )

    organization_id = order_scenario["grower"].id
    event = make_event(organization_id, quantity=10)

    # Process the same event twice.
    waste_analytics_consumer.process_event(event)
    waste_analytics_consumer.process_event(event)

    analytics = db_session.scalar(
        select(WasteAnalytics).where(
            WasteAnalytics.organization_id == organization_id,
            WasteAnalytics.waste_date == date.today(),
        )
    )

    # Duplicate processing must not increase the total.
    assert analytics is not None
    assert analytics.total_quantity == 10


def test_analytics_failure_rolls_back_event_claim(
    db_session, monkeypatch, order_scenario
):
    monkeypatch.setattr(
        waste_analytics_consumer,
        "SessionLocal",
        lambda: nullcontext(db_session),
    )

    organization_id = order_scenario["grower"].id
    event = make_event(organization_id, quantity=10)
    event_id = uuid.UUID(event["event_id"])

    original_execute = db_session.execute

    def failing_execute(statement, *args, **kwargs):
      table = getattr(statement, "table", None)

      if table is not None and table.name == "waste_analytics":
        raise SQLAlchemyError(
            "Simulated analytics database failure"
        )

      return original_execute(statement, *args, **kwargs)

    monkeypatch.setattr(db_session, "execute", failing_execute)

    with pytest.raises(
        SQLAlchemyError,
        match="Simulated analytics database failure",
    ):
        waste_analytics_consumer.process_event(event)

    # Restore normal database operations.
    monkeypatch.setattr(db_session, "execute", original_execute)

    # The processed-event claim must not remain in the database.
    processed = db_session.scalar(
        select(ProcessedEvent).where(
            ProcessedEvent.consumer_group
            == waste_analytics_consumer.GROUP_ID,
            ProcessedEvent.event_id == event_id,
        )
    )

    assert processed is None

    # The analytics projection must also remain unchanged.
    analytics = db_session.scalar(
        select(WasteAnalytics).where(
            WasteAnalytics.organization_id == organization_id,
            WasteAnalytics.waste_date == date.today(),
        )
    )

    assert analytics is None



from unittest.mock import Mock


def test_dlq_delivery_failure_raises():
    # Simulate a Kafka message with an invalid payload.
    message = Mock()
    message.topic.return_value = "bloombalance.inventory.waste"
    message.partition.return_value = 0
    message.offset.return_value = 1
    message.key.return_value = None
    message.value.return_value = b'{"invalid": true}'

    # Simulate a producer that never confirms delivery.
    producer = Mock()
    producer.flush.return_value = 0

    with pytest.raises(
        RuntimeError,
        match="DLQ delivery was not acknowledged",
    ):
        waste_analytics_consumer.publish_to_dlq(
            producer,
            message,
            ValueError("Invalid event"),
        )

    producer.produce.assert_called_once()


def test_waste_analytics_separates_units(
    db_session, monkeypatch, order_scenario
):
    monkeypatch.setattr(
        waste_analytics_consumer,
        "SessionLocal",
        lambda: nullcontext(db_session),
    )

    organization_id = order_scenario["grower"].id

    # Two different events for the same organization and date.
    stem_event = make_event(
        organization_id,
        quantity=20,
        unit="stem",
    )

    kg_event = make_event(
        organization_id,
        quantity=5,
        unit="kg",
    )

    waste_analytics_consumer.process_event(stem_event)
    waste_analytics_consumer.process_event(kg_event)

    analytics = db_session.scalars(
        select(WasteAnalytics).where(
            WasteAnalytics.organization_id == organization_id,
            WasteAnalytics.waste_date == date.today(),
        )
    ).all()

    totals_by_unit = {
        row.unit: row.total_quantity
        for row in analytics
    }

    assert totals_by_unit == {
        "stem": 20,
        "kg": 5,
    }


