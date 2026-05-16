"""add user_settings table

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("athlete_id", sa.BigInteger(), nullable=False),
        sa.Column("anthropic_api_key", sa.Text(), nullable=True),
        sa.Column("google_api_key", sa.Text(), nullable=True),
        sa.Column("preferred_provider", sa.String(50), nullable=True),
        sa.Column("preferred_model", sa.String(100), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("athlete_id"),
    )


def downgrade() -> None:
    op.drop_table("user_settings")
