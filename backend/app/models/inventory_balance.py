
from uuid import UUID
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class InventoryBalance(Base):
    __tablename__ = "inventory_balances"

    __table_args__ = (
        CheckConstraint(
            "available_quantity >= 0",
            name="ck_inventory_available_nonnegative"
        ),
        CheckConstraint(
            "reserved_quantity >= 0",
            name="ck_inventory_reserved_nonnegative"
        ),
    )

    batch_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("flower_batches.id"),
        primary_key=True
    )

    location_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True),
        ForeignKey("inventory_locations.id"),
        primary_key=True
    )

    available_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )

    reserved_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
