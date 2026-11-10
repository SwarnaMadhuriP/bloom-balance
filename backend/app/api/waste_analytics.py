
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.organization import Organization
from app.models.waste_analytics import WasteAnalytics


router = APIRouter(
    prefix="/analytics/waste",
    tags=["Waste Analytics"],
)


def get_db():
    with SessionLocal() as db:
        yield db


class WasteSummaryItem(BaseModel):
    unit: str
    total_quantity: int


class WasteDailyItem(BaseModel):
    waste_date: date
    unit: str
    total_quantity: int


@router.get("/summary", response_model=list[WasteSummaryItem])
def get_waste_summary(
    organization_id: uuid.UUID,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date cannot be after end_date",
        )

    organization = db.get(Organization, organization_id)

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    stmt = (
        select(
            WasteAnalytics.unit,
            func.sum(WasteAnalytics.total_quantity).label(
                "total_quantity"
            ),
        )
        .where(WasteAnalytics.organization_id == organization_id)
    )

    if start_date:
        stmt = stmt.where(WasteAnalytics.waste_date >= start_date)

    if end_date:
        stmt = stmt.where(WasteAnalytics.waste_date <= end_date)

    stmt = stmt.group_by(WasteAnalytics.unit).order_by(
        WasteAnalytics.unit
    )

    rows = db.execute(stmt).all()

    return [
        WasteSummaryItem(
            unit=row.unit,
            total_quantity=row.total_quantity,
        )
        for row in rows
    ]


@router.get("/daily", response_model=list[WasteDailyItem])
def get_daily_waste(
    organization_id: uuid.UUID,
    start_date: date | None = None,
    end_date: date | None = None,
    db: Session = Depends(get_db),
):
    if start_date and end_date and start_date > end_date:
        raise HTTPException(
            status_code=422,
            detail="start_date cannot be after end_date",
        )

    organization = db.get(Organization, organization_id)

    if organization is None:
        raise HTTPException(
            status_code=404,
            detail="Organization not found",
        )

    stmt = (
        select(WasteAnalytics)
        .where(WasteAnalytics.organization_id == organization_id)
    )

    if start_date:
        stmt = stmt.where(WasteAnalytics.waste_date >= start_date)

    if end_date:
        stmt = stmt.where(WasteAnalytics.waste_date <= end_date)

    stmt = stmt.order_by(
        WasteAnalytics.waste_date,
        WasteAnalytics.unit,
    )

    rows = db.scalars(stmt).all()

    return [
        WasteDailyItem(
            waste_date=row.waste_date,
            unit=row.unit,
            total_quantity=row.total_quantity,
        )
        for row in rows
    ]
