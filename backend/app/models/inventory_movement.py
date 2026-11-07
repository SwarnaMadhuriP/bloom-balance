
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InventoryMovement(Base):
    __tablename__ = "inventory_movements"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_inventory_movement_positive_quantity"
        ),
        CheckConstraint(
            "movement_type IN ('HARVEST', 'TRANSFER', 'RESERVATION', "
            "'RELEASE', 'DISPATCH', 'WASTE')",
            name="ck_inventory_movement_type"
        ),
        Index("ix_inventory_movement_batch_created", "batch_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flower_batches.id"),
        nullable=False
    )

    source_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_locations.id"),
        nullable=True
    )

    destination_location_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_locations.id"),
        nullable=True
    )

    movement_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    reference_type: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True
    )

    reference_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
