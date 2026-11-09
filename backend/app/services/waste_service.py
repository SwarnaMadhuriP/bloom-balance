
import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_location import InventoryLocation
from app.models.inventory_movement import InventoryMovement
from app.models.outbox_event import OutboxEvent
from app.models.waste_record import WasteRecord


def process_expired_inventory(db: Session):
    """
    Convert available expired inventory into waste.

    Creates WasteRecord, InventoryMovement, and OutboxEvent
    in one atomic database transaction.

    Reserved inventory remains untouched.
    """

    today = date.today()

    processed_balances = 0
    total_wasted_quantity = 0

    try:
        # 1. Find expired inventory and lock balance rows.
        stmt = (
            select(
                InventoryBalance,
                FlowerBatch,
                InventoryLocation,
                Flower,
            )
            .join(
                FlowerBatch,
                InventoryBalance.batch_id == FlowerBatch.id,
            )
            .join(
                InventoryLocation,
                InventoryBalance.location_id == InventoryLocation.id,
            )
            .join(
                Flower,
                FlowerBatch.flower_id == Flower.id,
            )
            .where(
                FlowerBatch.expiry_date < today,
                InventoryBalance.available_quantity > 0,
            )
            .order_by(
                InventoryBalance.batch_id,
                InventoryBalance.location_id,
            )
            .with_for_update(of=InventoryBalance)
        )

        rows = db.execute(stmt).all()

        for balance, batch, location, flower in rows:
            quantity_to_waste = balance.available_quantity

            # 2. Create waste record.
            waste_record = WasteRecord(
                organization_id=location.organization_id,
                batch_id=batch.id,
                location_id=location.id,
                quantity=quantity_to_waste,
                reason="EXPIRED",
            )

            db.add(waste_record)
            db.flush()

            # 3. Create inventory movement.
            movement = InventoryMovement(
                batch_id=batch.id,
                source_location_id=location.id,
                destination_location_id=None,
                movement_type="WASTE",
                quantity=quantity_to_waste,
                reference_type="WASTE_RECORD",
                reference_id=waste_record.id,
            )

            db.add(movement)

            # 4. Create transactional outbox event.
            event_id = uuid.uuid4()
            occurred_at = datetime.now(timezone.utc)

            event = OutboxEvent(
                id=event_id,
                aggregate_id=batch.id,
                event_type="InventoryWasteRecorded",
                payload={
                    "event_id": str(event_id),
                    "event_type": "InventoryWasteRecorded",
                    "waste_record_id": str(waste_record.id),
                    "batch_id": str(batch.id),
                    "organization_id": str(location.organization_id),
                    "location_id": str(location.id),
                    "quantity": quantity_to_waste,
                    "unit": flower.unit,
                    "reason": "EXPIRED",
                    "occurred_at": occurred_at.isoformat(),
                },
                status="PENDING",
            )

            db.add(event)

            # 5. Update available inventory.
            balance.available_quantity = 0

            processed_balances += 1
            total_wasted_quantity += quantity_to_waste

        # 6. Commit all changes atomically.
        db.commit()

        return {
            "processed_inventory_balances": processed_balances,
            "total_wasted_quantity": total_wasted_quantity,
        }

    except Exception:
        db.rollback()
        raise
