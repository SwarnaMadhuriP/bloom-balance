
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select, func
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
from app.models.outbox_event import OutboxEvent
from app.models.surplus_listing import SurplusListing
from app.schemas.order import OrderCreate


# ============================================================
# HELPERS
# ============================================================

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
            f"Order must be {expected}; current status is {order.status}",
        )


def add_order_event(
    db: Session,
    order: Order,
    event_type: str,
):
    """Insert an outbox event in the current transaction."""
    event = OutboxEvent(
        aggregate_id=order.id,
        event_type=event_type,
        payload={
            "event_type": event_type,
            "order_id": str(order.id),
            "seller_organization_id": str(
                order.seller_organization_id
            ),
            "buyer_organization_id": str(
                order.buyer_organization_id
            ),
        },
        status="PENDING",
    )

    db.add(event)


def get_order_allocations(
    db: Session,
    order_id: uuid.UUID,
):
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
        (allocation.batch_id, allocation.location_id)
        for allocation in allocations
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
            raise HTTPException(
                409,
                "Inventory balance not found",
            )

        balances[(batch_id, location_id)] = balance

    return balances


def allocation_totals(allocations):
    totals = {}

    for allocation in allocations:
        key = (
            allocation.batch_id,
            allocation.location_id,
        )

        totals[key] = (
            totals.get(key, 0) + allocation.quantity
        )

    return totals


# ============================================================
# CREATE ORDER
# ============================================================

def create_order(db: Session, request: OrderCreate):
    try:
        buyer = db.get(
            Organization,
            request.buyer_organization_id,
        )

        seller = db.get(
            Organization,
            request.seller_organization_id,
        )

        if buyer is None:
            raise HTTPException(
                404,
                "Buyer organization not found",
            )

        if seller is None:
            raise HTTPException(
                404,
                "Seller organization not found",
            )

        if buyer.id == seller.id:
            raise HTTPException(
                400,
                "Buyer and seller must be different",
            )

        if buyer.organization_type != "florist":
            raise HTTPException(
                400,
                "Buyer must be a florist",
            )

        if seller.organization_type != "grower":
            raise HTTPException(
                400,
                "Seller must be a grower",
            )

        flower_ids = {
            item.flower_id
            for item in request.items
        }

        existing_ids = set(
            db.scalars(
                select(Flower.id)
                .where(Flower.id.in_(flower_ids))
            ).all()
        )

        if existing_ids != flower_ids:
            raise HTTPException(
                404,
                "One or more flowers do not exist",
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
            "buyer_organization_id": (
                order.buyer_organization_id
            ),
            "seller_organization_id": (
                order.seller_organization_id
            ),
            "status": order.status,
            "total_amount": order.total_amount,
            "created_at": order.created_at,
            "items": items,
        }

    except Exception:
        db.rollback()
        raise


# ============================================================
# ACCEPT ORDER
# ============================================================

def accept_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "PENDING")

        items = db.scalars(
            select(OrderItem)
            .where(OrderItem.order_id == order.id)
            .order_by(OrderItem.id)
        ).all()

        if not items:
            raise HTTPException(
                409,
                "Order has no items",
            )

        flower_ids = {
            item.flower_id
            for item in items
        }

        surplus_ids = {
            item.surplus_listing_id
            for item in items
            if item.surplus_listing_id is not None
        }

        # Lock relevant batches in a stable order.
        batches = db.scalars(
            select(FlowerBatch)
            .where(
                FlowerBatch.grower_organization_id
                == order.seller_organization_id,
                FlowerBatch.flower_id.in_(flower_ids),
            )
            .order_by(FlowerBatch.id)
            .with_for_update()
        ).all()

        batch_by_id = {
            batch.id: batch
            for batch in batches
        }

        # Lock surplus listings.
        listings = (
            db.scalars(
                select(SurplusListing)
                .where(
                    SurplusListing.id.in_(surplus_ids)
                )
                .order_by(SurplusListing.id)
                .with_for_update()
            ).all()
            if surplus_ids
            else []
        )

        listing_by_id = {
            listing.id: listing
            for listing in listings
        }

        # Lock inventory balances.
        stock_rows = db.execute(
            select(InventoryBalance, FlowerBatch)
            .join(
                FlowerBatch,
                InventoryBalance.batch_id
                == FlowerBatch.id,
            )
            .join(
                InventoryLocation,
                InventoryBalance.location_id
                == InventoryLocation.id,
            )
            .where(
                FlowerBatch.grower_organization_id
                == order.seller_organization_id,
                InventoryLocation.organization_id
                == order.seller_organization_id,
                FlowerBatch.flower_id.in_(flower_ids),
                FlowerBatch.expiry_date >= date.today(),
            )
            .order_by(
                InventoryBalance.batch_id,
                InventoryBalance.location_id,
            )
            .with_for_update(of=InventoryBalance)
        ).all()

        stock_by_flower = {}
        stock_by_batch = {}

        for balance, batch in stock_rows:
            stock_by_flower.setdefault(
                batch.flower_id,
                [],
            ).append(balance)

            stock_by_batch.setdefault(
                batch.id,
                [],
            ).append(balance)

        # Protect quantities committed to active
        # surplus listings and pending surplus orders.
        now = datetime.now(timezone.utc)

        active_listing_rows = db.execute(
            select(
                SurplusListing.batch_id,
                func.coalesce(
                    func.sum(
                        SurplusListing.remaining_quantity
                    ),
                    0,
                ),
            )
            .where(
                SurplusListing.batch_id.in_(
                    list(batch_by_id.keys())
                ),
                SurplusListing.status == "ACTIVE",
                SurplusListing.expires_at > now,
            )
            .group_by(SurplusListing.batch_id)
        ).all()

        protected_by_batch = {
            batch_id: int(quantity)
            for batch_id, quantity
            in active_listing_rows
        }

        pending_rows = db.execute(
            select(
                SurplusListing.batch_id,
                func.coalesce(
                    func.sum(OrderItem.quantity),
                    0,
                ),
            )
            .join(
                OrderItem,
                OrderItem.surplus_listing_id
                == SurplusListing.id,
            )
            .join(
                Order,
                Order.id == OrderItem.order_id,
            )
            .where(
                SurplusListing.batch_id.in_(
                    list(batch_by_id.keys())
                ),
                Order.status == "PENDING",
            )
            .group_by(SurplusListing.batch_id)
        ).all()

        for batch_id, quantity in pending_rows:
            protected_by_batch[batch_id] = (
                protected_by_batch.get(batch_id, 0)
                + int(quantity)
            )

        # Allocate surplus purchases first.
        ordered_items = sorted(
            items,
            key=lambda item: (
                item.surplus_listing_id is None,
                str(item.id),
            ),
        )

        for item in ordered_items:
            remaining = item.quantity

            if item.surplus_listing_id is not None:
                listing = listing_by_id.get(
                    item.surplus_listing_id
                )

                if listing is None:
                    raise HTTPException(
                        409,
                        "Surplus listing not found",
                    )

                batch = batch_by_id.get(
                    listing.batch_id
                )

                if (
                    batch is None
                    or batch.flower_id != item.flower_id
                ):
                    raise HTTPException(
                        409,
                        "Invalid surplus batch",
                    )

                eligible_balances = (
                    stock_by_batch.get(
                        listing.batch_id,
                        [],
                    )
                )

                # Release this order's own
                # pending surplus commitment.
                protected_by_batch[
                    listing.batch_id
                ] -= item.quantity

            else:
                eligible_balances = (
                    stock_by_flower.get(
                        item.flower_id,
                        [],
                    )
                )

            for balance in eligible_balances:
                if remaining == 0:
                    break

                protected = (
                    protected_by_batch.get(
                        balance.batch_id,
                        0,
                    )
                )

                batch_available = sum(
                    row.available_quantity
                    for row in stock_by_batch.get(
                        balance.batch_id,
                        [],
                    )
                )

                usable = max(
                    0,
                    batch_available - protected,
                )

                allocated = min(
                    remaining,
                    balance.available_quantity,
                    usable,
                )

                if allocated <= 0:
                    continue

                balance.available_quantity -= allocated
                balance.reserved_quantity += allocated

                db.add(
                    OrderAllocation(
                        order_item_id=item.id,
                        batch_id=balance.batch_id,
                        location_id=balance.location_id,
                        quantity=allocated,
                    )
                )

                db.add(
                    InventoryMovement(
                        batch_id=balance.batch_id,
                        source_location_id=(
                            balance.location_id
                        ),
                        destination_location_id=None,
                        movement_type="RESERVATION",
                        quantity=allocated,
                        reference_type="ORDER_ITEM",
                        reference_id=item.id,
                    )
                )

                remaining -= allocated

            if remaining > 0:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Insufficient uncommitted inventory "
                        f"for flower {item.flower_id}"
                    ),
                )

        # Order and outbox event commit together.
        order.status = "ACCEPTED"

        add_order_event(
            db,
            order,
            "OrderAccepted",
        )

        db.commit()

        return {
            "order_id": str(order.id),
            "status": "ACCEPTED",
            "message": (
                "Order accepted and inventory reserved"
            ),
        }

    except Exception:
        db.rollback()
        raise


# ============================================================
# PREPARE ORDER
# ============================================================

def prepare_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "ACCEPTED")

        order.status = "PREPARING"

        add_order_event(
            db,
            order,
            "OrderPreparing",
        )

        db.commit()

        return {
            "order_id": str(order.id),
            "status": "PREPARING",
        }

    except Exception:
        db.rollback()
        raise


# ============================================================
# CANCEL ORDER
# ============================================================

def cancel_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)

        if order.status not in ("PENDING", "ACCEPTED"):
            raise HTTPException(
                409,
                f"Cannot cancel order in status {order.status}",
            )

        if order.status == "PENDING":
            items = db.scalars(
                select(OrderItem)
                .where(OrderItem.order_id == order.id)
                .order_by(OrderItem.id)
            ).all()

            surplus_items = [
                item
                for item in items
                if item.surplus_listing_id is not None
            ]

            if surplus_items:
                listing_ids = sorted({
                    item.surplus_listing_id
                    for item in surplus_items
                })

                # Lock batches before listings.
                batch_ids = db.scalars(
                    select(SurplusListing.batch_id)
                    .where(
                        SurplusListing.id.in_(
                            listing_ids
                        )
                    )
                ).all()

                db.scalars(
                    select(FlowerBatch)
                    .where(
                        FlowerBatch.id.in_(batch_ids)
                    )
                    .order_by(FlowerBatch.id)
                    .with_for_update()
                ).all()

                listings = db.scalars(
                    select(SurplusListing)
                    .where(
                        SurplusListing.id.in_(
                            listing_ids
                        )
                    )
                    .order_by(SurplusListing.id)
                    .with_for_update()
                ).all()

                listing_map = {
                    listing.id: listing
                    for listing in listings
                }

                now = datetime.now(timezone.utc)

                for item in surplus_items:
                    listing = listing_map.get(
                        item.surplus_listing_id
                    )

                    if listing is None:
                        raise HTTPException(
                            409,
                            "Surplus listing no longer exists",
                        )

                    # Restore only eligible listings.
                    if (
                        listing.status
                        in ("ACTIVE", "SOLD_OUT")
                        and listing.expires_at > now
                    ):
                        listing.remaining_quantity += (
                            item.quantity
                        )

                        if (
                            listing.remaining_quantity
                            > listing.listed_quantity
                        ):
                            raise HTTPException(
                                409,
                                "Surplus listing quantity exceeded",
                            )

                        if listing.status == "SOLD_OUT":
                            listing.status = "ACTIVE"

        elif order.status == "ACCEPTED":
            allocations = get_order_allocations(
                db,
                order.id,
            )

            if not allocations:
                raise HTTPException(
                    409,
                    "Accepted order has no allocations",
                )

            balances = lock_allocation_balances(
                db,
                allocations,
            )

            totals = allocation_totals(
                allocations
            )

            for key, quantity in totals.items():
                if (
                    balances[key].reserved_quantity
                    < quantity
                ):
                    raise HTTPException(
                        409,
                        "Insufficient reserved inventory",
                    )

            # Restore reserved inventory.
            for key, quantity in totals.items():
                balance = balances[key]

                balance.available_quantity += quantity
                balance.reserved_quantity -= quantity

            for allocation in allocations:
                db.add(
                    InventoryMovement(
                        batch_id=allocation.batch_id,
                        source_location_id=None,
                        destination_location_id=(
                            allocation.location_id
                        ),
                        movement_type="RELEASE",
                        quantity=allocation.quantity,
                        reference_type="ORDER_ITEM",
                        reference_id=(
                            allocation.order_item_id
                        ),
                    )
                )

        order.status = "CANCELLED"

        add_order_event(
            db,
            order,
            "OrderCancelled",
        )

        db.commit()

        return {
            "order_id": str(order.id),
            "status": "CANCELLED",
            "message": "Order cancelled successfully",
        }

    except Exception:
        db.rollback()
        raise


# ============================================================
# DISPATCH ORDER
# ============================================================

def dispatch_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "PREPARING")

        allocations = get_order_allocations(
            db,
            order.id,
        )

        if not allocations:
            raise HTTPException(
                409,
                "Order has no inventory allocations",
            )

        balances = lock_allocation_balances(
            db,
            allocations,
        )

        totals = allocation_totals(
            allocations
        )

        for key, quantity in totals.items():
            if (
                balances[key].reserved_quantity
                < quantity
            ):
                raise HTTPException(
                    409,
                    "Insufficient reserved inventory",
                )

        # Reserved stock leaves the warehouse.
        for key, quantity in totals.items():
            balances[key].reserved_quantity -= quantity

        for allocation in allocations:
            db.add(
                InventoryMovement(
                    batch_id=allocation.batch_id,
                    source_location_id=(
                        allocation.location_id
                    ),
                    destination_location_id=None,
                    movement_type="DISPATCH",
                    quantity=allocation.quantity,
                    reference_type="ORDER_ITEM",
                    reference_id=allocation.order_item_id,
                )
            )

        order.status = "DISPATCHED"

        add_order_event(
            db,
            order,
            "OrderDispatched",
        )

        db.commit()

        return {
            "order_id": str(order.id),
            "status": "DISPATCHED",
            "message": "Order dispatched successfully",
        }

    except Exception:
        db.rollback()
        raise


# ============================================================
# DELIVER ORDER
# ============================================================

def deliver_order(db: Session, order_id: uuid.UUID):
    try:
        order = get_locked_order(db, order_id)
        require_status(order, "DISPATCHED")

        order.status = "DELIVERED"

        add_order_event(
            db,
            order,
            "OrderDelivered",
        )

        db.commit()

        return {
            "order_id": str(order.id),
            "status": "DELIVERED",
            "message": "Order delivered successfully",
        }

    except Exception:
        db.rollback()
        raise
