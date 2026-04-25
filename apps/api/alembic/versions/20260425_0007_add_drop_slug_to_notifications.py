"""add drop_slug to notifications

Revision ID: 20260425_0007
Revises: 20260425_0006
Create Date: 2026-04-25 14:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0007"
down_revision = "20260425_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("drop_slug", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("notifications", "drop_slug")
