
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.database import SessionLocal
from app.models.organization import Organization
from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance
from app.models.outbox_event import OutboxEvent
from app.services.waste_service import process_expired_inventory


def main():
    with SessionLocal() as db:
        # Create a dedicated test grower.
        grower = Organization(
            name="Kafka Waste Demo Grower",
            organization_type="grower",
        )

        flower = Flower(
            name="Rose",
            variety="Kafka Waste Demo",
            color="Purple",
            unit="stem",
        )

        db.add_all([grower, flower])
        db.flush()

        batch = FlowerBatch(
            flower_id=flower.id,
            grower_organization_id=grower.id,
            harvest_date=date.today() - timedelta(days=10),
            expiry_date=date.today() - timedelta(days=1),
            initial_quantity=10,
            price_per_unit=Decimal("15.00"),
        )

        location = InventoryLocation(
            organization_id=grower.id,
            name="Kafka Demo Storage",
            location_type="cold_storage",
        )

        db.add_all([batch, location])
        db.flush()

        balance = InventoryBalance(
            batch_id=batch.id,
            location_id=location.id,
            available_quantity=10,
            reserved_quantity=0,
        )

        db.add(balance)
        db.commit()

        batch_id = batch.id

        print("Created expired test batch:", batch_id)

    # Process expired inventory.
    with SessionLocal() as db:
        result = process_expired_inventory(db)
        print("Waste processing result:", result)

    # Verify the outbox event.
    with SessionLocal() as db:
        events = db.scalars(
            select(OutboxEvent).where(
                OutboxEvent.aggregate_id == batch_id,
                OutboxEvent.event_type == "InventoryWasteRecorded",
            )
        ).all()

        for event in events:
            print("Outbox event:", event.id)
            print("Status:", event.status)
            print("Payload:", event.payload)


if __name__ == "__main__":
    main()
