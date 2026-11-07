
import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class FlowerBatch(Base):
    __tablename__ = "flower_batches"

    __table_args__ = (
        CheckConstraint(
            "initial_quantity > 0",
            name="ck_flower_batch_positive_quantity"
        ),
        CheckConstraint(
            "expiry_date >= harvest_date",
            name="ck_flower_batch_expiry_date"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    flower_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("flowers.id"),
        nullable=False,
        index=True
    )

    grower_organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True
    )

    harvest_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )

    expiry_date: Mapped[date] = mapped_column(
        Date,
        nullable=False
    )

    initial_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
