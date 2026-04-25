"""add countdown duration and expiry to drops

Revision ID: 20260425_0005
Revises: 20260425_0004
Create Date: 2026-04-25 12:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0005"
down_revision = "20260425_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("drops", sa.Column("duration_minutes", sa.Integer(), nullable=True))
    op.add_column("drops", sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("drops", "expires_at")
    op.drop_column("drops", "duration_minutes")
