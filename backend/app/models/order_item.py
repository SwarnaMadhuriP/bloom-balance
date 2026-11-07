
import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    Index,
    Integer,
    Numeric,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class OrderItem(Base):
    __tablename__ = "order_items"

    __table_args__ = (
        CheckConstraint(
            "quantity > 0",
            name="ck_order_item_positive_quantity"
        ),
        CheckConstraint(
            "unit_price >= 0",
            name="ck_order_item_price_nonnegative"
        ),
        Index("ix_order_items_order", "order_id"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False
    )

    flower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flowers.id"),
        nullable=False
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )
