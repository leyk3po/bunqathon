"""simplify drop states and persist bunq tab reference

Revision ID: 20260425_0004
Revises: 20260425_0003
Create Date: 2026-04-25 07:00:00
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260425_0004"
down_revision = "20260425_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()

    op.add_column("drops", sa.Column("bunq_tab_reference", sa.String(length=128), nullable=True))
    op.create_index("ix_drops_bunq_tab_reference", "drops", ["bunq_tab_reference"], unique=False)

    op.execute(
        """
        UPDATE drops
        SET bunq_tab_reference = (
            SELECT payments.bunq_reference
            FROM payments
            WHERE payments.drop_id = drops.id
              AND payments.bunq_reference IS NOT NULL
            ORDER BY payments.created_at DESC
            LIMIT 1
        )
        WHERE bunq_tab_reference IS NULL
        """
    )

    op.execute(
        """
        UPDATE drops
        SET state = CASE
            WHEN state IN ('processing', 'review') THEN 'draft'
            WHEN state IN ('partially_sold', 'paused') THEN 'live'
            WHEN state = 'expired' THEN 'archived'
            ELSE state
        END
        """
    )

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE drop_state RENAME TO drop_state_old")
        new_drop_state = postgresql.ENUM(
            "draft",
            "live",
            "sold_out",
            "archived",
            name="drop_state",
        )
        new_drop_state.create(bind, checkfirst=False)
        op.execute(
            """
            ALTER TABLE drops
            ALTER COLUMN state TYPE drop_state
            USING state::text::drop_state
            """
        )
        old_drop_state = postgresql.ENUM(name="drop_state_old")
        old_drop_state.drop(bind, checkfirst=False)


def downgrade() -> None:
    bind = op.get_bind()

    if bind.dialect.name == "postgresql":
        op.execute("ALTER TYPE drop_state RENAME TO drop_state_new")
        old_drop_state = postgresql.ENUM(
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
        old_drop_state.create(bind, checkfirst=False)
        op.execute(
            """
            ALTER TABLE drops
            ALTER COLUMN state TYPE drop_state
            USING state::text::drop_state
            """
        )
        new_drop_state = postgresql.ENUM(name="drop_state_new")
        new_drop_state.drop(bind, checkfirst=False)

    op.drop_index("ix_drops_bunq_tab_reference", table_name="drops")
    op.drop_column("drops", "bunq_tab_reference")
