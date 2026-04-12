"""add_variant_fields_and_line_item_variant

Revision ID: da0f5c11521f
Revises: 39a132a6266e
Create Date: 2026-04-12 22:24:29.824685

Adds:
  - item_variants.price_override      (nullable Float)
  - item_variants.low_stock_threshold (nullable Integer)
  - invoice_line_items.variant_id     (nullable FK → item_variants.id)
  - invoice_line_items.variant_value  (nullable String — snapshot of label at sale time)
  - stock_audits.variant_id           (nullable FK → item_variants.id)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'da0f5c11521f'
down_revision: Union[str, Sequence[str], None] = '39a132a6266e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # item_variants: per-variant price override and low-stock threshold
    with op.batch_alter_table('item_variants', schema=None) as batch_op:
        batch_op.add_column(sa.Column('price_override', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('low_stock_threshold', sa.Integer(), nullable=True))

    # invoice_line_items: which variant was sold + label snapshot
    with op.batch_alter_table('invoice_line_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('variant_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('variant_value', sa.String(100), nullable=True))
        batch_op.create_foreign_key(
            'fk_ili_variant_id', 'item_variants', ['variant_id'], ['id']
        )

    # stock_audits: link audit record to the specific variant (when applicable)
    with op.batch_alter_table('stock_audits', schema=None) as batch_op:
        batch_op.add_column(sa.Column('variant_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_sa_variant_id', 'item_variants', ['variant_id'], ['id']
        )


def downgrade() -> None:
    with op.batch_alter_table('stock_audits', schema=None) as batch_op:
        batch_op.drop_constraint('fk_sa_variant_id', type_='foreignkey')
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('invoice_line_items', schema=None) as batch_op:
        batch_op.drop_constraint('fk_ili_variant_id', type_='foreignkey')
        batch_op.drop_column('variant_value')
        batch_op.drop_column('variant_id')

    with op.batch_alter_table('item_variants', schema=None) as batch_op:
        batch_op.drop_column('low_stock_threshold')
        batch_op.drop_column('price_override')
