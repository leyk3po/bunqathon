"""add media_urls to drops

Revision ID: 20260425_0009
Revises: 20260425_0008
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "20260425_0009"
down_revision = "20260425_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "drops",
        sa.Column("media_urls", sa.JSON, nullable=True, server_default="[]"),
    )


def downgrade() -> None:
    op.drop_column("drops", "media_urls")
