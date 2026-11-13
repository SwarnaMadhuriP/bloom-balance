
import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.waste_record import WasteRecord
from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from datetime import date
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.surplus_listing import SurplusListing



def get_bloomtrace_summary(
    db: Session,
    organization_id: uuid.UUID,
):
    # 1. Total quantity wasted and number of records.
    totals = db.execute(
        select(
            func.coalesce(
                func.sum(WasteRecord.quantity), 0
            ),
            func.count(WasteRecord.id),
        ).where(
            WasteRecord.organization_id == organization_id
        )
    ).one()

    total_wasted = int(totals[0])
    total_records = int(totals[1])

    # 2. Group waste by reason.
    
    # Group waste by reason AND flower unit.
    reason_rows = db.execute(
        select(
            WasteRecord.reason,
            Flower.unit,
            func.sum(WasteRecord.quantity).label("quantity"),
        )
        .select_from(WasteRecord)
        .join(
            FlowerBatch,
            WasteRecord.batch_id == FlowerBatch.id,
        )
        .join(
            Flower,
            FlowerBatch.flower_id == Flower.id,
        )
        .where(
            WasteRecord.organization_id == organization_id
        )
        .group_by(WasteRecord.reason, Flower.unit)
        .order_by(WasteRecord.reason, Flower.unit)
    ).all()

    waste_by_reason = [
        {
            "reason": reason,
            "unit": unit,
            "quantity": int(quantity),
        }
        for reason, unit, quantity in reason_rows
    ]

 
    
    # Group wasted quantities by their actual units.
    unit_rows = db.execute(
        select(
            Flower.unit,
            func.sum(WasteRecord.quantity).label("quantity"),
        )
        .join(
            FlowerBatch,
            WasteRecord.batch_id == FlowerBatch.id,
        )
        .join(
            Flower,
            FlowerBatch.flower_id == Flower.id,
        )
        .where(
            WasteRecord.organization_id == organization_id
        )
        .group_by(Flower.unit)
        .order_by(Flower.unit)
    ).all()

    waste_by_unit = [
        {
            "unit": unit,
            "quantity": int(quantity),
        }
        for unit, quantity in unit_rows
    ]

    return {
        "organization_id": organization_id,
        "total_wasted": total_wasted,
        "total_waste_records": total_records,
        "waste_by_reason": waste_by_reason,
        "waste_by_unit": waste_by_unit,
    }


def get_waste_by_flower(
    db: Session,
    organization_id: uuid.UUID,
):
    rows = db.execute(
        select(
            Flower.id,
            Flower.name,
            Flower.variety,
            Flower.unit,
            func.sum(WasteRecord.quantity).label(
                "total_wasted"
            ),
        )
        .join(
            FlowerBatch,
            WasteRecord.batch_id == FlowerBatch.id,
        )
        .join(
            Flower,
            FlowerBatch.flower_id == Flower.id,
        )
        .where(
            WasteRecord.organization_id == organization_id
        )
        .group_by(
            Flower.id,
            Flower.name,
            Flower.variety,
            Flower.unit,
        )
        .order_by(
            func.sum(WasteRecord.quantity).desc()
        )
    ).all()

    return [
        {
            "flower_id": flower_id,
            "flower_name": name,
            "variety": variety,
            "unit": unit,
            "total_wasted": int(total_wasted),
        }
        for flower_id, name, variety, unit, total_wasted in rows
    ]



def get_daily_waste_trends(
    db: Session,
    organization_id: uuid.UUID,
    start_date: date,
    end_date: date,
):
    if start_date > end_date:
        raise ValueError(
            "start_date cannot be after end_date"
        )

    waste_date = func.date(WasteRecord.recorded_at)

    rows = db.execute(
        select(
            waste_date.label("date"),
            Flower.unit.label("unit"),
            func.sum(WasteRecord.quantity).label(
                "total_wasted"
            ),
            func.count(WasteRecord.id).label(
                "record_count"
            ),
        )
        .select_from(WasteRecord)
        .join(
            FlowerBatch,
            WasteRecord.batch_id == FlowerBatch.id,
        )
        .join(
            Flower,
            FlowerBatch.flower_id == Flower.id,
        )
        .where(
            WasteRecord.organization_id == organization_id,
            waste_date >= start_date,
            waste_date <= end_date,
        )
        .group_by(waste_date, Flower.unit)
        .order_by(waste_date, Flower.unit)
    ).all()

    return [
        {
            "date": recorded_date,
            "unit": unit,
            "total_wasted": int(total_wasted),
            "record_count": int(record_count),
        }
        for recorded_date, unit, total_wasted, record_count in rows
    ]



def get_rescued_flowers(
    db: Session,
    organization_id: uuid.UUID,
):
    rows = db.execute(
        select(
            func.coalesce(
                func.sum(OrderItem.quantity), 0
            ).label("total_rescued"),
            func.count(
                func.distinct(Order.id)
            ).label("delivered_surplus_orders"),
        )
        .join(
            Order,
            OrderItem.order_id == Order.id,
        )
        .join(
            SurplusListing,
            OrderItem.surplus_listing_id == SurplusListing.id,
        )
        .where(
            Order.seller_organization_id == organization_id,
            Order.status == "DELIVERED",
        )
    ).one()

    
    unit_rows = db.execute(
        select(
            Flower.unit,
            func.sum(OrderItem.quantity).label("quantity"),
        )
        .select_from(OrderItem)
        .join(
            Order,
            OrderItem.order_id == Order.id,
        )
        .join(
            SurplusListing,
            OrderItem.surplus_listing_id == SurplusListing.id,
        )
        .join(
            Flower,
            OrderItem.flower_id == Flower.id,
        )
        .where(
            Order.seller_organization_id == organization_id,
            Order.status == "DELIVERED",
        )
        .group_by(Flower.unit)
        .order_by(Flower.unit)
    ).all()

    rescued_by_unit = [
        {
            "unit": unit,
            "quantity": int(quantity),
        }
        for unit, quantity in unit_rows
    ]

    return {
        "organization_id": organization_id,
        "total_rescued": int(rows.total_rescued),
        "delivered_surplus_orders": int(
            rows.delivered_surplus_orders
        ),
        "rescued_by_unit": rescued_by_unit,
    }

