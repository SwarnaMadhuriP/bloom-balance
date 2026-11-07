
import uuid
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_location import InventoryLocation
from app.models.organization import Organization


def list_marketplace_flowers(
    db: Session,
    search: str | None = None,
    color: str | None = None,
    grower_id: uuid.UUID | None = None,
    min_quantity: int = 1,
    limit: int = 20,
    offset: int = 0,
):
    available = func.sum(
        InventoryBalance.available_quantity
    ).label("available_quantity")

    query = (
        select(
            FlowerBatch.id.label("batch_id"),
            Flower.id.label("flower_id"),
            Flower.name,
            Flower.variety,
            Flower.color,
            Flower.unit,
            FlowerBatch.price_per_unit,
            Organization.id.label("grower_organization_id"),
            Organization.name.label("grower_name"),
            available,
            FlowerBatch.harvest_date,
            FlowerBatch.expiry_date,
        )
        .join(Flower, Flower.id == FlowerBatch.flower_id)
        .join(
            InventoryBalance,
            InventoryBalance.batch_id == FlowerBatch.id,
        )
        .join(
            InventoryLocation,
            InventoryLocation.id == InventoryBalance.location_id,
        )
        .join(
            Organization,
            Organization.id == FlowerBatch.grower_organization_id,
        )
        .where(
            FlowerBatch.expiry_date >= date.today(),
            InventoryBalance.available_quantity > 0,
            InventoryLocation.organization_id
            == FlowerBatch.grower_organization_id,
        )
    )

    if search:
        query = query.where(
            Flower.name.ilike(f"%{search}%")
            | Flower.variety.ilike(f"%{search}%")
        )

    if color:
        query = query.where(Flower.color.ilike(color))

    if grower_id:
        query = query.where(
            FlowerBatch.grower_organization_id == grower_id
        )

    query = (
        query.group_by(
            FlowerBatch.id,
            Flower.id,
            Organization.id,
        )
        .having(available >= min_quantity)
    )

    total = db.scalar(
        select(func.count()).select_from(query.subquery())
    )

    rows = db.execute(
        query.order_by(
            FlowerBatch.expiry_date.asc(),
            FlowerBatch.id.asc(),
        )
        .limit(limit)
        .offset(offset)
    ).mappings().all()

    return {
        "flowers": [dict(row) for row in rows],
        "total": total or 0,
        "limit": limit,
        "offset": offset,
    }
