
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, status, Query, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.schemas.order import OrderCreate, OrderResponse
from app.services import order_service
from sqlalchemy import select
from app.models.order import Order
from app.models.flower import Flower
from app.models.organization import Organization

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

@router.get(
    "",
    response_model=list[OrderResponse],
)
def get_orders(
    db: Annotated[Session, Depends(get_db)],
    seller_organization_id: uuid.UUID | None = None,
    buyer_organization_id: uuid.UUID | None = None,
):
    if seller_organization_id is None and buyer_organization_id is None:
        raise HTTPException(
            status_code=400,
            detail="Provide seller_organization_id or buyer_organization_id",
        )

    statement = (
        select(Order)
        .options(selectinload(Order.items))
    )

    if seller_organization_id is not None:
        statement = statement.where(
            Order.seller_organization_id == seller_organization_id
        )

    if buyer_organization_id is not None:
        statement = statement.where(
            Order.buyer_organization_id == buyer_organization_id
        )

    orders = db.scalars(
        statement.order_by(Order.created_at.desc())
    ).all()

    if not orders:
        return []

    organization_ids = {
        organization_id
        for order in orders
        for organization_id in (
            order.buyer_organization_id,
            order.seller_organization_id,
        )
    }

    flower_ids = {
        item.flower_id
        for order in orders
        for item in order.items
    }

    organizations = {
        organization.id: organization
        for organization in db.scalars(
            select(Organization).where(
                Organization.id.in_(organization_ids)
            )
        ).all()
    }

    flowers = {
        flower.id: flower
        for flower in db.scalars(
            select(Flower).where(
                Flower.id.in_(flower_ids)
            )
        ).all()
    } if flower_ids else {}

    results = []

    for order in orders:
        order_data = OrderResponse.model_validate(order)

        seller = organizations.get(order.seller_organization_id)
        buyer = organizations.get(order.buyer_organization_id)

        order_data.seller_name = seller.name if seller else None
        order_data.buyer_name = buyer.name if buyer else None

        for item_data in order_data.items:
            flower = flowers.get(item_data.flower_id)

            if flower:
                item_data.flower_name = flower.name
                item_data.flower_variety = flower.variety
                item_data.flower_color = flower.color
                item_data.flower_unit = flower.unit

        results.append(order_data)

    return results

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
