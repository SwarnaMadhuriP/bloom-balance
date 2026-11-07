
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Delivery(Base):
    __tablename__ = "deliveries"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'DISPATCHED', 'IN_TRANSIT', "
            "'DELIVERED', 'FAILED')",
            name="ck_delivery_status"
        ),
        CheckConstraint(
            "delivered_at IS NULL OR dispatched_at IS NOT NULL",
            name="ck_delivery_dispatch_before_delivery"
        ),
        Index("ix_deliveries_status", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id"),
        nullable=False,
        unique=True
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING"
    )

    tracking_reference: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True
    )

    dispatched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    delivered_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
