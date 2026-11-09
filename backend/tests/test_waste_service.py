
from datetime import date, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest
from sqlalchemy import select, func

from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_movement import InventoryMovement
from app.models.waste_record import WasteRecord
from app.models.outbox_event import OutboxEvent


from app.services.waste_service import process_expired_inventory


@pytest.fixture
def expired_inventory(db_session):
    """Create an expired batch with available inventory."""

    grower = Organization(
        name="Waste Test Grower",
        organization_type="grower",
    )

    flower = Flower(
        name="Rose",
        variety="Waste Test Hybrid",
        color="Pink",
        unit="stem",
    )

    db_session.add_all([grower, flower])
    db_session.flush()

    batch = FlowerBatch(
        flower_id=flower.id,
        grower_organization_id=grower.id,
        harvest_date=date.today() - timedelta(days=10),
        expiry_date=date.today() - timedelta(days=1),
        initial_quantity=300,
        price_per_unit=Decimal("20.00"),
    )

    location = InventoryLocation(
        organization_id=grower.id,
        name="Waste Test Storage",
        location_type="cold_storage",
    )

    db_session.add_all([batch, location])
    db_session.flush()

    balance = InventoryBalance(
        batch_id=batch.id,
        location_id=location.id,
        available_quantity=200,
        reserved_quantity=50,
    )

    db_session.add(balance)
    db_session.commit()

    return {
        "batch": batch,
        "location": location,
        "balance": balance,
        "grower": grower,
    }


def test_expired_inventory_creates_waste_record(
    db_session, expired_inventory
):
    result = process_expired_inventory(db_session)

    assert result["processed_inventory_balances"] == 1
    assert result["total_wasted_quantity"] == 200

    records = db_session.scalars(
        select(WasteRecord).where(
            WasteRecord.batch_id == expired_inventory["batch"].id
        )
    ).all()

    assert len(records) == 1
    assert records[0].quantity == 200
    assert records[0].reason == "EXPIRED"
    assert records[0].organization_id == expired_inventory["grower"].id

    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.batch_id == expired_inventory["batch"].id,
            InventoryMovement.movement_type == "WASTE",
        )
    ).all()

    assert len(movements) == 1
    assert movements[0].quantity == 200
    assert movements[0].reference_type == "WASTE_RECORD"
    assert movements[0].reference_id == records[0].id


def test_reserved_inventory_is_preserved(
    db_session, expired_inventory
):
    process_expired_inventory(db_session)

    balance = expired_inventory["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 0
    assert balance.reserved_quantity == 50


def test_waste_processing_is_idempotent(
    db_session, expired_inventory
):
    first = process_expired_inventory(db_session)
    second = process_expired_inventory(db_session)

    assert first["total_wasted_quantity"] == 200
    assert second["total_wasted_quantity"] == 0
    assert second["processed_inventory_balances"] == 0

    record_count = db_session.scalar(
        select(func.count())
        .select_from(WasteRecord)
        .where(
            WasteRecord.batch_id == expired_inventory["batch"].id
        )
    )

    movement_count = db_session.scalar(
        select(func.count())
        .select_from(InventoryMovement)
        .where(
            InventoryMovement.batch_id == expired_inventory["batch"].id,
            InventoryMovement.movement_type == "WASTE",
        )
    )

    assert record_count == 1
    assert movement_count == 1


def test_waste_processing_rolls_back_on_failure(
    db_session, expired_inventory
):
    # Simulate a database failure while flushing the waste record.
    with patch.object(
        db_session,
        "flush",
        side_effect=RuntimeError("Simulated database failure"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Simulated database failure",
        ):
            process_expired_inventory(db_session)

    balance = expired_inventory["balance"]
    db_session.refresh(balance)

    assert balance.available_quantity == 200
    assert balance.reserved_quantity == 50

    records = db_session.scalars(
        select(WasteRecord).where(
            WasteRecord.batch_id == expired_inventory["batch"].id
        )
    ).all()

    assert len(records) == 0

    movements = db_session.scalars(
        select(InventoryMovement).where(
            InventoryMovement.batch_id == expired_inventory["batch"].id,
            InventoryMovement.movement_type == "WASTE",
        )
    ).all()

    assert len(movements) == 0


def test_waste_processing_creates_outbox_event(
    db_session, expired_inventory
):
    process_expired_inventory(db_session)

    events = db_session.scalars(
        select(OutboxEvent).where(
            OutboxEvent.aggregate_id == expired_inventory["batch"].id,
            OutboxEvent.event_type == "InventoryWasteRecorded",
        )
    ).all()

    assert len(events) == 1

    event = events[0]

    assert event.status == "PENDING"
    assert event.published_at is None
    assert event.payload["event_id"] == str(event.id)
    assert event.payload["event_type"] == "InventoryWasteRecorded"
    assert event.payload["quantity"] == 200
    assert event.payload["batch_id"] == str(
        expired_inventory["batch"].id
    )


def test_duplicate_processing_does_not_create_duplicate_events(
    db_session, expired_inventory
):
    process_expired_inventory(db_session)
    process_expired_inventory(db_session)

    events = db_session.scalars(
        select(OutboxEvent).where(
            OutboxEvent.aggregate_id == expired_inventory["batch"].id,
            OutboxEvent.event_type == "InventoryWasteRecorded",
        )
    ).all()

    assert len(events) == 1


def test_failed_processing_does_not_create_outbox_event(
    db_session, expired_inventory
):
    with patch.object(
        db_session,
        "flush",
        side_effect=RuntimeError("Simulated database failure"),
    ):
        with pytest.raises(
            RuntimeError,
            match="Simulated database failure",
        ):
            process_expired_inventory(db_session)

    events = db_session.scalars(
        select(OutboxEvent).where(
            OutboxEvent.aggregate_id == expired_inventory["batch"].id,
            OutboxEvent.event_type == "InventoryWasteRecorded",
        )
    ).all()

    assert len(events) == 0

