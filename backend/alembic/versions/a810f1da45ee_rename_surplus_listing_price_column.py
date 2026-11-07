"""rename surplus listing price column

Revision ID: a810f1da45ee
Revises: 40d766917f8f
Create Date: 2026-11-07 17:18:37.097015

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a810f1da45ee'
down_revision: Union[str, Sequence[str], None] = '40d766917f8f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    # 1. Remove the old price constraint.
    op.drop_constraint(
        "ck_surplus_price_nonnegative",
        "surplus_listings",
        type_="check",
    )

    # 2. Rename the column without losing existing prices.
    op.alter_column(
        "surplus_listings",
        "price_per_stem",
        new_column_name="price_per_unit",
        existing_type=sa.Numeric(10, 2),
        existing_nullable=False,
    )

    # 3. Enforce positive prices.
    op.create_check_constraint(
        "ck_surplus_price_positive",
        "surplus_listings",
        "price_per_unit > 0",
    )


def downgrade() -> None:
    # 1. Remove the new price constraint.
    op.drop_constraint(
        "ck_surplus_price_positive",
        "surplus_listings",
        type_="check",
    )

    # 2. Restore the original column name.
    op.alter_column(
        "surplus_listings",
        "price_per_unit",
        new_column_name="price_per_stem",
        existing_type=sa.Numeric(10, 2),
        existing_nullable=False,
    )

    # 3. Restore the original constraint.
    op.create_check_constraint(
        "ck_surplus_price_nonnegative",
        "surplus_listings",
        "price_per_stem >= 0",
    )
