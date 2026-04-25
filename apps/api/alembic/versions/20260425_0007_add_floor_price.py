"""add floor_price_cents to drops (haggle minimum)

Revision ID: 20260425_0007
Revises: 20260425_0006
Create Date: 2026-04-25 14:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0007"
down_revision = "20260425_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("drops", sa.Column("floor_price_cents", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("drops", "floor_price_cents")
