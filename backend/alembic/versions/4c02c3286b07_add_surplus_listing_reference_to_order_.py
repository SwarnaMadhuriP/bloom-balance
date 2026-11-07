"""add surplus listing reference to order items

Revision ID: 4c02c3286b07
Revises: a810f1da45ee
Create Date: 2026-11-07 17:40:55.555470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c02c3286b07'
down_revision: Union[str, Sequence[str], None] = 'a810f1da45ee'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None



def upgrade() -> None:
    op.add_column(
        "order_items",
        sa.Column(
            "surplus_listing_id",
            sa.UUID(),
            nullable=True,
        ),
    )

    op.create_index(
        "ix_order_items_surplus_listing_id",
        "order_items",
        ["surplus_listing_id"],
        unique=False,
    )

    op.create_foreign_key(
        "fk_order_items_surplus_listing",
        "order_items",
        "surplus_listings",
        ["surplus_listing_id"],
        ["id"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "fk_order_items_surplus_listing",
        "order_items",
        type_="foreignkey",
    )

    op.drop_index(
        "ix_order_items_surplus_listing_id",
        table_name="order_items",
    )

    op.drop_column(
        "order_items",
        "surplus_listing_id",
    )

