
import uuid
from datetime import date

from sqlalchemy import (
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class WasteAnalytics(Base):
    __tablename__ = "waste_analytics"

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "waste_date",
            "unit",
            name="uq_waste_analytics_org_date_unit",
        ),
        CheckConstraint(
            "total_quantity >= 0",
            name="ck_waste_analytics_nonnegative_quantity",
        ),
        CheckConstraint(
            "unit IN ('stem', 'bunch', 'kg')",
            name="ck_waste_analytics_valid_unit",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
    )

    waste_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
    )

    total_quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
    )
