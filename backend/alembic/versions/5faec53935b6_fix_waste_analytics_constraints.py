"""fix waste analytics constraints

Revision ID: 5faec53935b6
Revises: c03139208ac8
Create Date: 2026-11-10 17:17:05.141460

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5faec53935b6'
down_revision: Union[str, Sequence[str], None] = 'c03139208ac8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint(
        "uq_waste_analytics_org_date",
        "waste_analytics",
        type_="unique",
    )

    op.create_unique_constraint(
        "uq_waste_analytics_org_date_unit",
        "waste_analytics",
        ["organization_id", "waste_date", "unit"],
    )

    op.create_check_constraint(
        "ck_waste_analytics_valid_unit",
        "waste_analytics",
        "unit IN ('stem', 'bunch', 'kg')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_waste_analytics_valid_unit",
        "waste_analytics",
        type_="check",
    )

    op.drop_constraint(
        "uq_waste_analytics_org_date_unit",
        "waste_analytics",
        type_="unique",
    )

    op.create_unique_constraint(
        "uq_waste_analytics_org_date",
        "waste_analytics",
        ["organization_id", "waste_date"],
    )
