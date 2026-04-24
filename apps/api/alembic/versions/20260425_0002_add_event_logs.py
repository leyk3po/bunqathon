"""add event logs

Revision ID: 20260425_0002
Revises: 20260425_0001
Create Date: 2026-04-25 00:30:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0002"
down_revision = "20260425_0001"
branch_labels = None
depends_on = None


event_source = sa.Enum(
    "domain",
    "webhook",
    "payment",
    "system",
    name="event_source",
)


def upgrade() -> None:
    bind = op.get_bind()
    event_source.create(bind, checkfirst=True)

    op.create_table(
        "event_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("drop_id", sa.String(length=36), nullable=True),
        sa.Column("payment_id", sa.String(length=36), nullable=True),
        sa.Column("source", event_source, nullable=False, server_default="domain"),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("external_id", sa.String(length=128), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["drop_id"], ["drops.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source", "external_id", name="uq_event_logs_source_external_id"),
    )
    op.create_index("ix_event_logs_drop_id", "event_logs", ["drop_id"], unique=False)
    op.create_index("ix_event_logs_payment_id", "event_logs", ["payment_id"], unique=False)
    op.create_index("ix_event_logs_source", "event_logs", ["source"], unique=False)
    op.create_index("ix_event_logs_event_type", "event_logs", ["event_type"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_event_logs_event_type", table_name="event_logs")
    op.drop_index("ix_event_logs_source", table_name="event_logs")
    op.drop_index("ix_event_logs_payment_id", table_name="event_logs")
    op.drop_index("ix_event_logs_drop_id", table_name="event_logs")
    op.drop_table("event_logs")

    bind = op.get_bind()
    event_source.drop(bind, checkfirst=True)
