"""segment_efforts table

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("activities", sa.Column("segments_fetched", sa.Boolean(), nullable=False, server_default="false"))

    op.create_table(
        "segment_efforts",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("activity_id", sa.BigInteger(), nullable=False),
        sa.Column("athlete_id", sa.BigInteger(), nullable=False),
        sa.Column("segment_id", sa.BigInteger(), nullable=False),
        sa.Column("segment_name", sa.Text(), nullable=True),
        sa.Column("sport_type", sa.String(50), nullable=True),
        sa.Column("elapsed_time", sa.Integer(), nullable=True),
        sa.Column("moving_time", sa.Integer(), nullable=True),
        sa.Column("distance", sa.Float(), nullable=True),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_date_local", sa.DateTime(timezone=True), nullable=True),
        sa.Column("pr_rank", sa.Integer(), nullable=True),
        sa.Column("kom_rank", sa.Integer(), nullable=True),
        sa.Column("average_watts", sa.Float(), nullable=True),
        sa.Column("average_heartrate", sa.Float(), nullable=True),
        sa.Column("average_cadence", sa.Float(), nullable=True),
        sa.Column("achievements", postgresql.JSONB(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_segment_efforts_activity_id", "segment_efforts", ["activity_id"])
    op.create_index("ix_segment_efforts_athlete_id", "segment_efforts", ["athlete_id"])
    op.create_index("ix_segment_efforts_segment_id", "segment_efforts", ["segment_id"])
    op.create_index("ix_segment_efforts_sport_type", "segment_efforts", ["sport_type"])


def downgrade() -> None:
    op.drop_table("segment_efforts")
    op.drop_column("activities", "segments_fetched")
