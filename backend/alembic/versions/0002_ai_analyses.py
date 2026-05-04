"""add ai_analyses table

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_analyses",
        sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column("athlete_id", sa.BigInteger(), nullable=False),
        sa.Column("analysis_type", sa.String(50), nullable=False),
        sa.Column("activity_id", sa.BigInteger(), nullable=True),
        sa.Column("week_key", sa.String(10), nullable=True),
        sa.Column("content", postgresql.JSONB(), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=True),
        sa.Column("output_tokens", sa.Integer(), nullable=True),
        sa.Column("model", sa.String(100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"]),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_ai_analyses_athlete_id", "ai_analyses", ["athlete_id"])
    op.create_index("idx_ai_analyses_activity_id", "ai_analyses", ["activity_id"])
    op.create_index("idx_ai_analyses_week_key", "ai_analyses", ["week_key"])


def downgrade() -> None:
    op.drop_table("ai_analyses")
