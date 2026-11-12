
import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.notification import Notification


router = APIRouter(
    prefix="/notifications",
    tags=["Notifications"],
)


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    organization_id: uuid.UUID
    order_id: uuid.UUID
    notification_type: str
    message: str
    status: str
    created_at: datetime


class UnreadCountResponse(BaseModel):
    unread_count: int


@router.get(
    "",
    response_model=list[NotificationResponse],
)
def get_notifications(
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
):
    statement = (
        select(Notification)
        .where(Notification.organization_id == organization_id)
        .order_by(
            Notification.created_at.desc(),
            Notification.id.desc(),
        )
        .limit(limit)
    )

    return db.scalars(statement).all()


@router.get(
    "/unread-count",
    response_model=UnreadCountResponse,
)
def get_unread_count(
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    statement = (
        select(func.count(Notification.id))
        .where(
            Notification.organization_id == organization_id,
            Notification.status == "UNREAD",
        )
    )

    count = db.scalar(statement) or 0

    return UnreadCountResponse(unread_count=count)


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_notification_read(
    notification_id: uuid.UUID,
    organization_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    statement = (
        select(Notification)
        .where(
            Notification.id == notification_id,
            Notification.organization_id == organization_id,
        )
        .with_for_update()
    )

    notification = db.scalar(statement)

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification.status = "READ"

    db.commit()
    db.refresh(notification)

    return notification
