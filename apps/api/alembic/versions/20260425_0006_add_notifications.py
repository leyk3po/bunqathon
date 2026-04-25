"""add notifications table

Revision ID: 20260425_0006
Revises: 20260425_0005
Create Date: 2026-04-25 13:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0006"
down_revision = "20260425_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("seller_id", sa.String(36), nullable=False, index=True),
        sa.Column("drop_id", sa.String(36), sa.ForeignKey("drops.id", ondelete="SET NULL"), nullable=True),
        sa.Column("drop_title", sa.Text(), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="EUR"),
        sa.Column("read", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_notifications_drop_id", "notifications", ["drop_id"])


def downgrade() -> None:
    op.drop_index("ix_notifications_drop_id", table_name="notifications")
    op.drop_table("notifications")
