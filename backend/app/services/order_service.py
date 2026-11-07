
import uuid
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_allocation import OrderAllocation
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_location import InventoryLocation
from app.models.inventory_movement import InventoryMovement

from app.schemas.order import OrderCreate


def get_locked_order(db: Session, order_id: uuid.UUID):
    order = db.scalar(
        select(Order)
        .where(Order.id == order_id)
        .with_for_update()
    )

    if order is None:
        raise HTTPException(404, "Order not found")

    return order


def require_status(order: Order, expected: str):
    if order.status != expected:
        raise HTTPException(
            409,
            f"Order must be {expected}; current status is {order.status}"
        )


def get_order_allocations(db: Session, order_id: uuid.UUID):
    return db.scalars(
        select(OrderAllocation)
        .join(
            OrderItem,
            OrderAllocation.order_item_id == OrderItem.id,
        )
        .where(OrderItem.order_id == order_id)
        .order_by(
            OrderAllocation.batch_id,
            OrderAllocation.location_id,
            OrderAllocation.id,
        )
    ).all()


def lock_allocation_balances(db: Session, allocations):
    keys = sorted({
        (a.batch_id, a.location_id)
        for a in allocations
    })

    balances = {}

    for batch_id, location_id in keys:
        balance = db.scalar(
            select(InventoryBalance)
            .where(
                InventoryBalance.batch_id == batch_id,
                InventoryBalance.location_id == location_id,
            )
            .with_for_update()
        )

        if balance is None:
            raise HTTPException(409, "Inventory balance not found")

        balances[(batch_id, location_id)] = balance

    return balances


def allocation_totals(allocations):
    totals = {}

    for allocation in allocations:
        key = (allocation.batch_id, allocation.location_id)
        totals[key] = totals.get(key, 0) + allocation.quantity

    return totals


def create_order(db: Session, request: OrderCreate):
    try:
        buyer = db.get(
            Organization, request.buyer_organization_id
        )
        seller = db.get(
            Organization, request.seller_organization_id
        )

        if buyer is None:
            raise HTTPException(404, "Buyer organization not found")

        if seller is None:
            raise HTTPException(404, "Seller organization not found")

        if buyer.id == seller.id:
            raise HTTPException(
                400, "Buyer and seller must be different"
            )

        if buyer.organization_type != "florist":
            raise HTTPException(400, "Buyer must be a florist")

        if seller.organization_type != "grower":
            raise HTTPException(400, "Seller must be a grower")

        flower_ids = {item.flower_id for item in request.items}

        existing_ids = set(
            db.scalars(
                select(Flower.id)
                .where(Flower.id.in_(flower_ids))
            ).all()
        )

        if existing_ids != flower_ids:
            raise HTTPException(
                404, "One or more flowers do not exist"
            )

        total = sum(
            (
                item.unit_price * item.quantity
                for item in request.items
            ),
            Decimal("0.00"),
        )

        order = Order(
            buyer_organization_id=buyer.id,
            seller_organization_id=seller.id,
            status="PENDING",
            total_amount=total,
        )

        db.add(order)
        db.flush()

        items = []

        for item in request.items:
            order_item = OrderItem(
                order_id=order.id,
                flower_id=item.flower_id,
                quantity=item.quantity,
                unit_price=item.unit_price,
            )
            db.add(order_item)
            items.append(order_item)

        db.flush()
        db.commit()
        db.refresh(order)

        return {
            "id": order.id,
            "buyer_organization_id": order.buyer_organization_id,
            "seller_organization_id": order.seller_organization_id,
            "status": order.status,
            "total_amount": order.total_amount,
            "created_at": order.created_at,
            "items": items,
        }

    except Exception:
        db.rollback()
        raise



def accept_order(db: Session, order_id: uuid.UUID):
    try:
        # 1. Lock the order to prevent duplicate acceptance.
        order = get_locked_order(db, order_id)
        require_status(order, "PENDING")

        # 2. Fetch order items in a consistent order.
        items = db.scalars(
            select(OrderItem)
            .where(OrderItem.order_id == order.id)
            .order_by(OrderItem.id)
        ).all()

        if not items:
            raise HTTPException(
                status_code=409,
                detail="Order has no items",
            )

        # Only fetch inventory for requested flowers.
        flower_ids = {item.flower_id for item in items}

        # 3. Lock eligible inventory rows.
        stock_rows = db.execute(
            select(InventoryBalance, FlowerBatch)
            .join(
                FlowerBatch,
                InventoryBalance.batch_id == FlowerBatch.id,
            )
            .join(
                InventoryLocation,
                InventoryBalance.location_id == InventoryLocation.id,
            )
            .where(
                FlowerBatch.grower_organization_id
                == order.seller_organization_id,

                InventoryLocation.organization_id
                == order.seller_organization_id,

                FlowerBatch.flower_id.in_(flower_ids),

                FlowerBatch.expiry_date >= date.today(),

                InventoryBalance.available_quantity > 0,
            )
            .order_by(
                InventoryBalance.batch_id,
                InventoryBalance.location_id,
            )
            .with_for_update(of=InventoryBalance)
        ).all()

        # 4. Group inventory balances by flower.
        stock_by_flower = {}

        for balance, batch in stock_rows:
            stock_by_flower.setdefault(
                batch.flower_id, []
            ).append(balance)

        # 5. Reserve inventory for every order item.
        for item in items:
            remaining = item.quantity

            for balance in stock_by_flower.get(
                item.flower_id, []
            ):
                if remaining == 0:
                    break

                allocated = min(
                    remaining,
                    balance.available_quantity,
                )

                if allocated <= 0:
                    continue

                # Move available stock into reserved stock.
                balance.available_quantity -= allocated
                balance.reserved_quantity += allocated

                # Record which batch fulfills this order item.
                db.add(
                    OrderAllocation(
                        order_item_id=item.id,
                        batch_id=balance.batch_id,
                        location_id=balance.location_id,
                        quantity=allocated,
                    )
                )

                # Record the inventory movement.
                db.add(
                    InventoryMovement(
                        batch_id=balance.batch_id,
                        source_location_id=balance.location_id,
                        destination_location_id=None,
                        movement_type="RESERVATION",
                        quantity=allocated,
                        reference_type="ORDER_ITEM",
                        reference_id=item.id,
                    )
                )

                remaining -= allocated

            # All-or-nothing reservation.
            if remaining > 0:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Insufficient inventory for flower "
                        f"{item.flower_id}"
                    ),
                )

        # 6. Update order status.
        order.status = "ACCEPTED"

        # 7. Commit all changes atomically.
        db.commit()

        return {
            "order_id": str(order.id),
            "status": "ACCEPTED",
            "message": "Order accepted and inventory reserved",
        }

    except Exception:
        db.rollback()
        raise



def prepare_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "ACCEPTED")

        order.status = "PREPARING"
        db.commit()

        return {
            "order_id": str(order.id),
            "status": "PREPARING",
        }

    except Exception:
        db.rollback()
        raise


def cancel_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)

        if order.status not in ("PENDING", "ACCEPTED"):
            raise HTTPException(
                409,
                f"Cannot cancel order in status {order.status}",
            )

        if order.status == "ACCEPTED":
            allocations = get_order_allocations(db, order.id)

            if not allocations:
                raise HTTPException(
                    409, "Accepted order has no allocations"
                )

            balances = lock_allocation_balances(db, allocations)
            totals = allocation_totals(allocations)

            # Validate before modifying anything.
            for key, quantity in totals.items():
                if balances[key].reserved_quantity < quantity:
                    raise HTTPException(
                        409, "Insufficient reserved inventory"
                    )

            for key, quantity in totals.items():
                balance = balances[key]
                balance.available_quantity += quantity
                balance.reserved_quantity -= quantity

            for allocation in allocations:
                db.add(
                    InventoryMovement(
                        batch_id=allocation.batch_id,
                        source_location_id=None,
                        destination_location_id=allocation.location_id,
                        movement_type="RELEASE",
                        quantity=allocation.quantity,
                        reference_type="ORDER_ITEM",
                        reference_id=allocation.order_item_id,
                    )
                )

        order.status = "CANCELLED"
        db.commit()

        return {
            "order_id": str(order.id),
            "status": "CANCELLED",
            "message": "Order cancelled successfully",
        }

    except Exception:
        db.rollback()
        raise


def dispatch_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "PREPARING")

        allocations = get_order_allocations(db, order.id)

        if not allocations:
            raise HTTPException(
                409, "Order has no inventory allocations"
            )

        balances = lock_allocation_balances(db, allocations)
        totals = allocation_totals(allocations)

        for key, quantity in totals.items():
            if balances[key].reserved_quantity < quantity:
                raise HTTPException(
                    409, "Insufficient reserved inventory"
                )

        # Reserved stock leaves the warehouse.
        for key, quantity in totals.items():
            balances[key].reserved_quantity -= quantity

        for allocation in allocations:
            db.add(
                InventoryMovement(
                    batch_id=allocation.batch_id,
                    source_location_id=allocation.location_id,
                    destination_location_id=None,
                    movement_type="DISPATCH",
                    quantity=allocation.quantity,
                    reference_type="ORDER_ITEM",
                    reference_id=allocation.order_item_id,
                )
            )

        order.status = "DISPATCHED"
        db.commit()

        return {
            "order_id": str(order.id),
            "status": "DISPATCHED",
            "message": "Order dispatched successfully",
        }

    except Exception:
        db.rollback()
        raise


def deliver_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "DISPATCHED")

        order.status = "DELIVERED"
        db.commit()

        return {
            "order_id": str(order.id),
            "status": "DELIVERED",
            "message": "Order delivered successfully",
        }

    except Exception:
        db.rollback()
        raise
