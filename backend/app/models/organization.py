
import uuid
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Organization(Base):
    __tablename__ = "organizations"

    __table_args__ = (
        CheckConstraint(
            "organization_type IN ('grower', 'florist', 'wholesaler', 'donor')",
            name="ck_organization_type"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False
    )

    organization_type: Mapped[str] = mapped_column(
        String(30),
        nullable=False
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
