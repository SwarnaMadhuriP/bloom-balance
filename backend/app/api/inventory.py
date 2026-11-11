from typing import Annotated
from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.flower import Flower
from app.models.flower_batch import FlowerBatch
from app.models.inventory_location import InventoryLocation
from app.models.inventory_balance import InventoryBalance
from app.models.inventory_movement import InventoryMovement
from app.schemas.inventory import InventoryReceiveRequest

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get("/locations")
def get_inventory_locations(
    organization_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    locations = db.scalars(
        select(InventoryLocation)
        .where(InventoryLocation.organization_id == organization_id)
        .order_by(InventoryLocation.name)
    ).all()
    return [
        {
            "id": location.id,
            "organization_id": location.organization_id,
            "name": location.name,
            "location_type": location.location_type,
        }
        for location in locations
    ]


@router.post("/receive", status_code=status.HTTP_201_CREATED)
def receive_inventory(
    request: InventoryReceiveRequest,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        batch = db.scalar(
            select(FlowerBatch)
            .where(FlowerBatch.id == request.batch_id)
            .with_for_update()
        )
        if batch is None:
            raise HTTPException(404, "Flower batch not found")

        location = db.get(InventoryLocation, request.location_id)
        if location is None:
            raise HTTPException(404, "Inventory location not found")
        if location.organization_id != batch.grower_organization_id:
            raise HTTPException(400, "Location does not belong to the batch's grower")

        total_received = db.scalar(
            select(func.coalesce(func.sum(InventoryMovement.quantity), 0))
            .where(
                InventoryMovement.batch_id == request.batch_id,
                InventoryMovement.movement_type == "HARVEST",
            )
        )
        if total_received + request.quantity > batch.initial_quantity:
            raise HTTPException(409, "Receiving exceeds the batch's initial quantity")

        balance = db.get(InventoryBalance, (request.batch_id, request.location_id))
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


@router.get("")
def get_inventory(
    organization_id: UUID,
    db: Annotated[Session, Depends(get_db)],
):
    statement = (
        select(InventoryBalance, FlowerBatch, Flower, InventoryLocation)
        .join(FlowerBatch, InventoryBalance.batch_id == FlowerBatch.id)
        .join(Flower, FlowerBatch.flower_id == Flower.id)
        .join(InventoryLocation, InventoryBalance.location_id == InventoryLocation.id)
        .where(
            FlowerBatch.grower_organization_id == organization_id,
            InventoryLocation.organization_id == organization_id,
        )
        .order_by(FlowerBatch.expiry_date.asc())
    )
    rows = db.execute(statement).all()
    inventory = []
    for balance, batch, flower, location in rows:
        days_until_expiry = (batch.expiry_date - date.today()).days
        if days_until_expiry < 0:
            freshness_status = "EXPIRED"
        elif days_until_expiry <= 3:
            freshness_status = "EXPIRING_SOON"
        else:
            freshness_status = "FRESH"
        inventory.append({
            "batch_id": batch.id,
            "flower_id": flower.id,
            "flower_name": flower.name,
            "variety": flower.variety,
            "location_id": location.id,
            "location_name": location.name,
            "harvest_date": batch.harvest_date,
            "expiry_date": batch.expiry_date,
            "price_per_unit": batch.price_per_unit,
            "available_quantity": balance.available_quantity,
            "reserved_quantity": balance.reserved_quantity,
            "freshness_status": freshness_status,
            "days_until_expiry": days_until_expiry,
        })
    return {
        "organization_id": organization_id,
        "total_records": len(inventory),
        "inventory": inventory,
    }
