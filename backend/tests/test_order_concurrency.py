
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta
from decimal import Decimal
from threading import Barrier

from fastapi import HTTPException
from sqlalchemy import select, func

from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.organization import Organization
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance
from app.models.order import Order
from app.models.order_item import OrderItem
from app.models.order_allocation import OrderAllocation
from app.services.order_service import accept_order


def test_concurrent_orders_do_not_oversell(concurrency_db):
    SessionFactory = concurrency_db

    # 1. Create committed test data
    with SessionFactory() as db:
        grower = Organization(
            name="Concurrency Grower",
            organization_type="grower",
        )

        florist = Organization(
            name="Concurrency Florist",
            organization_type="florist",
        )

        flower = Flower(
            name="Rose",
            variety="Red",
            color="Red",
        )

        db.add_all([grower, florist, flower])
        db.flush()

        batch = FlowerBatch(
            flower_id=flower.id,
            grower_organization_id=grower.id,
            harvest_date=date.today(),
            expiry_date=date.today() + timedelta(days=7),
            initial_quantity=300,
            price_per_unit=Decimal("10.00"),
        )

        location = InventoryLocation(
            organization_id=grower.id,
            name="Concurrency Warehouse",
            location_type="cold_storage",
        )

        db.add_all([batch, location])
        db.flush()

        balance = InventoryBalance(
            batch_id=batch.id,
            location_id=location.id,
            available_quantity=300,
            reserved_quantity=0,
        )

        db.add(balance)

        order1 = Order(
            buyer_organization_id=florist.id,
            seller_organization_id=grower.id,
            status="PENDING",
        )

        order2 = Order(
            buyer_organization_id=florist.id,
            seller_organization_id=grower.id,
            status="PENDING",
        )

        db.add_all([order1, order2])
        db.flush()

        db.add_all([
            OrderItem(
                order_id=order1.id,
                flower_id=flower.id,
                quantity=200,
                unit_price=20,
            ),
            OrderItem(
                order_id=order2.id,
                flower_id=flower.id,
                quantity=200,
                unit_price=20,
            ),
        ])

        order_ids = [order1.id, order2.id]
        batch_id = batch.id
        location_id = location.id

        db.commit()

    # 2. Run independent transactions concurrently
    barrier = Barrier(2)

    def accept_in_thread(order_id):
        with SessionFactory() as db:
            barrier.wait(timeout=10)

            try:
                result = accept_order(db, order_id)
                return result["status"]

            except HTTPException as exc:
                return exc.status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        futures = [
            executor.submit(accept_in_thread, order_id)
            for order_id in order_ids
        ]

        results = [
            future.result(timeout=20)
            for future in futures
        ]

    # 3. Exactly one order succeeds
    assert sorted(results, key=str) == sorted(
        ["ACCEPTED", 409],
        key=str,
    )

    # 4. Verify committed database state
    with SessionFactory() as db:
        balance = db.get(
            InventoryBalance,
            (batch_id, location_id),
        )

        assert balance is not None
        assert balance.available_quantity == 100
        assert balance.reserved_quantity == 200

        orders = db.scalars(
            select(Order).where(Order.id.in_(order_ids))
        ).all()

        assert sorted(order.status for order in orders) == [
            "ACCEPTED",
            "PENDING",
        ]

        allocation_count = db.scalar(
            select(func.count())
            .select_from(OrderAllocation)
        )

        assert allocation_count == 1

        total_allocated = db.scalar(
            select(func.sum(OrderAllocation.quantity))
        )

        assert total_allocated == 200
