
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.order import OrderCreate, OrderResponse
from app.services import order_service


router = APIRouter(
    prefix="/orders",
    tags=["Orders"],
)


@router.post(
    "",
    response_model=OrderResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_order(
    request: OrderCreate,
    db: Annotated[Session, Depends(get_db)],
):
    return order_service.create_order(db, request)


@router.post("/{order_id}/accept")
def accept_order(
    order_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return order_service.accept_order(db, order_id)


@router.post("/{order_id}/prepare")
def prepare_order(
    order_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return order_service.prepare_order(db, order_id)


@router.post("/{order_id}/dispatch")
def dispatch_order(
    order_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return order_service.dispatch_order(db, order_id)


@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return order_service.cancel_order(db, order_id)


@router.post("/{order_id}/deliver")
def deliver_order(
    order_id: uuid.UUID,
    db: Annotated[Session, Depends(get_db)],
):
    return order_service.deliver_order(db, order_id)
