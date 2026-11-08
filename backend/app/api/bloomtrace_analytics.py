
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db

from datetime import date

from app.schemas.bloomtrace_analytics import (
    WasteByFlowerResponse, DailyWasteTrendResponse, BloomTraceSummaryResponse, RescuedFlowersResponse
)
from app.services.bloomtrace_analytics_service import (
    get_daily_waste_trends, get_waste_by_flower, get_bloomtrace_summary, get_rescued_flowers
)


router = APIRouter(
    prefix="/bloomtrace/analytics",
    tags=["BloomTrace Analytics"],
)


@router.get(
    "/summary",
    response_model=BloomTraceSummaryResponse,
)
def bloomtrace_summary(
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return get_bloomtrace_summary(
        db=db,
        organization_id=organization_id,
    )



@router.get(
    "/waste-by-flower",
    response_model=list[WasteByFlowerResponse],
)
def waste_by_flower(
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return get_waste_by_flower(
        db=db,
        organization_id=organization_id,
    )


@router.get(
    "/daily-waste",
    response_model=list[DailyWasteTrendResponse],
)
def daily_waste(
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    start_date: date = Query(...),
    end_date: date = Query(...),
):
    if start_date > end_date:
        raise HTTPException(
            status_code=400,
            detail="start_date cannot be after end_date",
        )

    return get_daily_waste_trends(
        db=db,
        organization_id=organization_id,
        start_date=start_date,
        end_date=end_date,
    )



@router.get(
    "/rescued-flowers",
    response_model=RescuedFlowersResponse,
)
def rescued_flowers(
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return get_rescued_flowers(
        db=db,
        organization_id=organization_id,
    )
