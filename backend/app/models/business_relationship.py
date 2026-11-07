
import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class BusinessRelationship(Base):
    __tablename__ = "business_relationships"

    __table_args__ = (
        UniqueConstraint(
            "grower_organization_id",
            "florist_organization_id",
            name="uq_grower_florist_relationship"
        ),
        CheckConstraint(
            "grower_organization_id != florist_organization_id",
            name="ck_different_organizations"
        ),
        CheckConstraint(
            "status IN ('PENDING', 'ACTIVE', 'REJECTED', 'INACTIVE')",
            name="ck_business_relationship_status"
        ),
        Index(
            "ix_business_relationship_grower",
            "grower_organization_id"
        ),
        Index(
            "ix_business_relationship_florist",
            "florist_organization_id"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4
    )

    grower_organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False
    )

    florist_organization_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False
    )

    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="PENDING"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
