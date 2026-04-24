"""create drops and payments

Revision ID: 20260425_0001
Revises:
Create Date: 2026-04-25 00:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260425_0001"
down_revision = None
branch_labels = None
depends_on = None


drop_state = sa.Enum(
    "draft",
    "processing",
    "review",
    "live",
    "partially_sold",
    "sold_out",
    "paused",
    "expired",
    "archived",
    name="drop_state",
)

payment_status = sa.Enum(
    "pending",
    "paid",
    "failed",
    "expired",
    name="payment_status",
)


def upgrade() -> None:
    bind = op.get_bind()
    drop_state.create(bind, checkfirst=True)
    payment_status.create(bind, checkfirst=True)

    op.create_table(
        "drops",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("slug", sa.String(length=64), nullable=False),
        sa.Column("seller_id", sa.String(length=64), nullable=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("pitch", sa.Text(), nullable=True),
        sa.Column("price_cents", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column("inventory", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sold_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("media_url", sa.Text(), nullable=True),
        sa.Column("bunq_tab_url", sa.Text(), nullable=True),
        sa.Column("bunq_tab_uuid", sa.String(length=64), nullable=True),
        sa.Column("state", drop_state, nullable=False, server_default="draft"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_drops_slug"),
    )
    op.create_index("ix_drops_slug", "drops", ["slug"], unique=True)
    op.create_index("ix_drops_seller_id", "drops", ["seller_id"], unique=False)
    op.create_index("ix_drops_state", "drops", ["state"], unique=False)

    op.create_table(
        "payments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("drop_id", sa.String(length=36), nullable=False),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="EUR"),
        sa.Column("bunq_reference", sa.String(length=128), nullable=True),
        sa.Column("status", payment_status, nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["drop_id"], ["drops.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_payments_drop_id", "payments", ["drop_id"], unique=False)
    op.create_index("ix_payments_bunq_reference", "payments", ["bunq_reference"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_payments_bunq_reference", table_name="payments")
    op.drop_index("ix_payments_drop_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("ix_drops_state", table_name="drops")
    op.drop_index("ix_drops_seller_id", table_name="drops")
    op.drop_index("ix_drops_slug", table_name="drops")
    op.drop_table("drops")

    bind = op.get_bind()
    payment_status.drop(bind, checkfirst=True)
    drop_state.drop(bind, checkfirst=True)
