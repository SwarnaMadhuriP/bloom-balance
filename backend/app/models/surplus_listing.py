
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SurplusListing(Base):
    __tablename__ = "surplus_listings"

    __table_args__ = (
        CheckConstraint(
            "listed_quantity > 0",
            name="ck_surplus_listed_positive"
        ),
        CheckConstraint(
            "remaining_quantity >= 0 AND remaining_quantity <= listed_quantity",
            name="ck_surplus_remaining_quantity"
        ),
        CheckConstraint(
            "price_per_stem >= 0",
            name="ck_surplus_price_nonnegative"
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'SOLD_OUT', 'EXPIRED', 'CANCELLED')",
            name="ck_surplus_status"
        ),
        Index(
            "ix_surplus_status_expiry",
            "status",
            "expires_at"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    batch_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flower_batches.id"),
        nullable=False,
        index=True
    )

    grower_organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True
    )

    listed_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    remaining_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    price_per_stem: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="ACTIVE"
    )

    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
