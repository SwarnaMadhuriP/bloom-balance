
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Order(Base):
    __tablename__ = "orders"

    __table_args__ = (
        CheckConstraint(
            "buyer_organization_id != seller_organization_id",
            name="ck_order_different_organizations"
        ),
        CheckConstraint(
            "status IN ('PENDING', 'ACCEPTED', 'PREPARING', "
            "'DISPATCHED', 'DELIVERED', 'CANCELLED', 'REJECTED')",
            name="ck_order_status"
        ),
        CheckConstraint(
            "total_amount >= 0",
            name="ck_order_total_nonnegative"
        ),
        Index("ix_orders_buyer_created", "buyer_organization_id", "created_at"),
        Index("ix_orders_seller_status", "seller_organization_id", "status"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    buyer_organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False
    )

    seller_organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING"
    )

    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00")
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    items: Mapped[list["OrderItem"]] = relationship(
    "OrderItem",
    back_populates="order",
    lazy="selectin",
)
