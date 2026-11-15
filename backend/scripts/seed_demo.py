
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid5, NAMESPACE_DNS

from app.database import SessionLocal
from app.models.organization import Organization
from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance


GROWER_ID = UUID("71e9058b-5570-4fea-971f-c36454df62a1")
FLORIST_ID = UUID("17c0a1cf-ce6a-45c5-b364-d376a8e369d8")

FLOWERS = [
    (
        "1fb50b97-2b5c-44ae-8b04-856af6d77b27",
        "Lavender", "Normal", None, 200, "20.00"
    ),
    (
        "316ca001-0f6f-49e0-a905-112c8e319365",
        "Rose", "Hybrid Tea", "Red", 500, "15.00"
    ),
    (
        "2955f9de-c232-46a8-9c76-d42ae8ca9840",
        "Sunflower", "American Giant", None, 250, "30.00"
    ),
]


def seed():
    today = date.today()

    with SessionLocal.begin() as db:
        organizations = [
            (GROWER_ID, "Rosewood Flower Farm", "grower"),
            (FLORIST_ID, "Bloom Florist", "florist"),
        ]

        for org_id, name, org_type in organizations:
            if db.get(Organization, org_id) is None:
                db.add(
                    Organization(
                        id=org_id,
                        name=name,
                        organization_type=org_type,
                    )
                )

        db.flush()

        location_id = uuid5(
            NAMESPACE_DNS,
            "bloombalance-demo-grower-storage",
        )

        if db.get(InventoryLocation, location_id) is None:
            db.add(
                InventoryLocation(
                    id=location_id,
                    organization_id=GROWER_ID,
                    name="Main Cold Storage",
                    location_type="cold_storage",
                )
            )

        db.flush()

        for flower_id, name, variety, color, quantity, price in FLOWERS:
            flower_uuid = UUID(flower_id)

            if db.get(Flower, flower_uuid) is None:
                db.add(
                    Flower(
                        id=flower_uuid,
                        name=name,
                        variety=variety,
                        color=color,
                        unit="stem",
                    )
                )

        db.flush()

        for flower_id, name, variety, color, quantity, price in FLOWERS:
            flower_uuid = UUID(flower_id)

            batch_id = uuid5(
                NAMESPACE_DNS,
                f"bloombalance-demo-{flower_id}",
            )

            if db.get(FlowerBatch, batch_id) is None:
                db.add(
                    FlowerBatch(
                        id=batch_id,
                        flower_id=flower_uuid,
                        grower_organization_id=GROWER_ID,
                        harvest_date=today,
                        expiry_date=today + timedelta(days=30),
                        initial_quantity=quantity,
                        price_per_unit=Decimal(price),
                    )
                )

        db.flush()

        for flower_id, name, variety, color, quantity, price in FLOWERS:
            batch_id = uuid5(
                NAMESPACE_DNS,
                f"bloombalance-demo-{flower_id}",
            )

            if db.get(InventoryBalance, (batch_id, location_id)) is None:
                db.add(
                    InventoryBalance(
                        batch_id=batch_id,
                        location_id=location_id,
                        available_quantity=quantity,
                        reserved_quantity=0,
                    )
                )

        db.flush()

    print("Demo data seeded successfully.")
    print(f"Grower ID: {GROWER_ID}")
    print(f"Florist ID: {FLORIST_ID}")
    print(f"Inventory Location ID: {location_id}")
    print(f"Flowers configured: {len(FLOWERS)}")


if __name__ == "__main__":
    seed()
