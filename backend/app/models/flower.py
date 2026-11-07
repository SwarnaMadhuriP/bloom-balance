
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Flower(Base):
    __tablename__ = "flowers"

    __table_args__ = (
        UniqueConstraint(
            "name",
            "variety",
            "color",
            name="uq_flower_name_variety_color"
        ),
        CheckConstraint(
            "unit IN ('stem', 'bunch', 'kg')",
            name="ck_flower_unit"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    variety: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    color: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True
    )

    unit: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="stem"
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
