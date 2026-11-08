
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.flower_batch import FlowerBatch
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_location import InventoryLocation
from app.models.inventory_movement import InventoryMovement
from app.models.waste_record import WasteRecord
from app.schemas.waste_record import WasteRecordCreate


def create_waste_record(
    db: Session,
    request: WasteRecordCreate,
):
    try:
        # Lock the batch to coordinate inventory changes.
        batch = db.scalar(
            select(FlowerBatch)
            .where(FlowerBatch.id == request.batch_id)
            .with_for_update()
        )

        if batch is None:
            raise HTTPException(
                404, "Flower batch not found"
            )

        if batch.grower_organization_id != request.organization_id:
            raise HTTPException(
                403, "Batch does not belong to organization"
            )

        location = db.get(
            InventoryLocation,
            request.location_id,
        )

        if location is None:
            raise HTTPException(
                404, "Inventory location not found"
            )

        if location.organization_id != request.organization_id:
            raise HTTPException(
                403, "Location does not belong to organization"
            )

        # Lock the exact inventory balance.
        balance = db.scalar(
            select(InventoryBalance)
            .where(
                InventoryBalance.batch_id == request.batch_id,
                InventoryBalance.location_id == request.location_id,
            )
            .with_for_update()
        )

        if balance is None:
            raise HTTPException(
                404, "Inventory balance not found"
            )

        if balance.available_quantity < request.quantity:
            raise HTTPException(
                409, "Insufficient available inventory"
            )

        # Deduct waste from available stock only.
        balance.available_quantity -= request.quantity

        waste = WasteRecord(
            organization_id=request.organization_id,
            batch_id=request.batch_id,
            location_id=request.location_id,
            quantity=request.quantity,
            reason=request.reason,
        )

        db.add(waste)
        db.flush()

        movement = InventoryMovement(
            batch_id=request.batch_id,
            source_location_id=request.location_id,
            destination_location_id=None,
            movement_type="WASTE",
            quantity=request.quantity,
            reference_type="WASTE_RECORD",
            reference_id=waste.id,
        )

        db.add(movement)

        db.commit()
        db.refresh(waste)

        return waste

    except Exception:
        db.rollback()
        raise
