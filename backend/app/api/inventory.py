
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.flower_batch import FlowerBatch
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_movement import InventoryMovement
from app.schemas.inventory import InventoryReceiveRequest


router = APIRouter(
    prefix="/inventory",
    tags=["Inventory"],
)


@router.post("/receive", status_code=status.HTTP_201_CREATED)
def receive_inventory(
    request: InventoryReceiveRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        # Lock the batch to serialize receiving operations.
        batch = db.scalar(
            select(FlowerBatch)
            .where(FlowerBatch.id == request.batch_id)
            .with_for_update()
        )

        if batch is None:
            raise HTTPException(404, "Flower batch not found")

        location = db.get(
            InventoryLocation,
            request.location_id,
        )

        if location is None:
            raise HTTPException(404, "Inventory location not found")

        if location.organization_id != batch.grower_organization_id:
            raise HTTPException(
                400,
                "Location does not belong to the batch's grower",
            )

        # Count all previous HARVEST receipts for this batch.
        total_received = db.scalar(
            select(func.coalesce(func.sum(InventoryMovement.quantity), 0))
            .where(
                InventoryMovement.batch_id == request.batch_id,
                InventoryMovement.movement_type == "HARVEST",
            )
        )

        if total_received + request.quantity > batch.initial_quantity:
            raise HTTPException(
                409,
                "Receiving exceeds the batch's initial quantity",
            )

        # Find the balance for this batch/location pair.
        balance = db.get(
            InventoryBalance,
            (request.batch_id, request.location_id),
        )

        if balance is None:
            balance = InventoryBalance(
                batch_id=request.batch_id,
                location_id=request.location_id,
                available_quantity=0,
                reserved_quantity=0,
            )
            db.add(balance)

        balance.available_quantity += request.quantity

        movement = InventoryMovement(
            batch_id=request.batch_id,
            source_location_id=None,
            destination_location_id=request.location_id,
            movement_type="HARVEST",
            quantity=request.quantity,
        )

        db.add(movement)
        db.commit()

        return {
            "message": "Inventory received successfully",
            "batch_id": request.batch_id,
            "location_id": request.location_id,
            "received_quantity": request.quantity,
            "available_quantity": balance.available_quantity,
        }

    except Exception:
        db.rollback()
        raise
