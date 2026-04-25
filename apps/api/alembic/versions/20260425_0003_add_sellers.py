"""add sellers

Revision ID: 20260425_0003
Revises: 20260425_0002
Create Date: 2026-04-25 02:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0003"
down_revision = "20260425_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "sellers",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("display_name", sa.String(length=80), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email", name="uq_sellers_email"),
    )
    op.create_index("ix_sellers_email", "sellers", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_sellers_email", table_name="sellers")
    op.drop_table("sellers")
