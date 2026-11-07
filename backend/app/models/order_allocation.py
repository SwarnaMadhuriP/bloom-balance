
import uuid

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OrderAllocation(Base):
    __tablename__ = "order_allocations"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_order_allocation_positive_quantity"
        ),
        Index("ix_order_allocations_order_item", "order_item_id"),
        Index("ix_order_allocations_batch_location", "batch_id", "location_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    order_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_items.id"),
        nullable=False
    )

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flower_batches.id"),
        nullable=False
    )

    location_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("inventory_locations.id"),
        nullable=False
    )

    surplus_listing_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("surplus_listings.id"),
        nullable=True
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
