"""add flower batch pricing

Revision ID: 40d766917f8f
Revises: 1f8be3f15102
Create Date: 2026-11-07 16:00:43.865705

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '40d766917f8f'
down_revision: Union[str, Sequence[str], None] = '1f8be3f15102'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    # 1. Add the column with a temporary default
    # to populate existing flower batches.
    op.add_column(
        "flower_batches",
        sa.Column(
            "price_per_unit",
            sa.Numeric(precision=10, scale=2),
            nullable=False,
            server_default="20.00",
        ),
    )

    # 2. Ensure every batch has a positive price.
    op.create_check_constraint(
        "ck_flower_batch_positive_price",
        "flower_batches",
        "price_per_unit > 0",
    )

    # 3. Remove the default for future batches.
    op.alter_column(
        "flower_batches",
        "price_per_unit",
        server_default=None,
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_flower_batch_positive_price",
        "flower_batches",
        type_="check",
    )

    op.drop_column(
        "flower_batches",
        "price_per_unit",
    )

