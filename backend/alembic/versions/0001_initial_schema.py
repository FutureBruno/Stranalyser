"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-05-04
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "athletes",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("username", sa.String(100), nullable=True),
        sa.Column("firstname", sa.String(100), nullable=True),
        sa.Column("lastname", sa.String(100), nullable=True),
        sa.Column("profile_medium", sa.Text(), nullable=True),
        sa.Column("city", sa.String(100), nullable=True),
        sa.Column("country", sa.String(100), nullable=True),
        sa.Column("sex", sa.String(1), nullable=True),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("token_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("scope", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "activities",
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column("athlete_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.Text(), nullable=True),
        sa.Column("sport_type", sa.String(50), nullable=True),
        sa.Column("type", sa.String(50), nullable=True),
        sa.Column("start_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("start_date_local", sa.DateTime(timezone=True), nullable=True),
        sa.Column("timezone", sa.String(100), nullable=True),
        sa.Column("distance", sa.Float(), nullable=True),
        sa.Column("moving_time", sa.Integer(), nullable=True),
        sa.Column("elapsed_time", sa.Integer(), nullable=True),
        sa.Column("total_elevation_gain", sa.Float(), nullable=True),
        sa.Column("average_speed", sa.Float(), nullable=True),
        sa.Column("max_speed", sa.Float(), nullable=True),
        sa.Column("average_heartrate", sa.Float(), nullable=True),
        sa.Column("max_heartrate", sa.Float(), nullable=True),
        sa.Column("average_watts", sa.Float(), nullable=True),
        sa.Column("average_cadence", sa.Float(), nullable=True),
        sa.Column("suffer_score", sa.Integer(), nullable=True),
        sa.Column("kudos_count", sa.Integer(), nullable=True),
        sa.Column("achievement_count", sa.Integer(), nullable=True),
        sa.Column("map_id", sa.String(50), nullable=True),
        sa.Column("polyline", sa.Text(), nullable=True),
        sa.Column("start_latlng", postgresql.ARRAY(sa.Float()), nullable=True),
        sa.Column("end_latlng", postgresql.ARRAY(sa.Float()), nullable=True),
        sa.Column("workout_type", sa.Integer(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("gear_id", sa.String(50), nullable=True),
        sa.Column("trainer", sa.Boolean(), nullable=True),
        sa.Column("commute", sa.Boolean(), nullable=True),
        sa.Column("manual", sa.Boolean(), nullable=True),
        sa.Column("private", sa.Boolean(), nullable=True),
        sa.Column("flagged", sa.Boolean(), nullable=True),
        sa.Column("raw", postgresql.JSONB(), nullable=True),
        sa.Column("streams_fetched", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_activities_athlete_id", "activities", ["athlete_id"])
    op.create_index("idx_activities_start_date", "activities", [sa.text("start_date DESC")])
    op.create_index("idx_activities_sport_type", "activities", ["sport_type"])

    op.create_table(
        "activity_streams",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("activity_id", sa.BigInteger(), nullable=False),
        sa.Column("stream_type", sa.String(50), nullable=False),
        sa.Column("data", postgresql.JSONB(), nullable=False),
        sa.Column("original_size", sa.Integer(), nullable=True),
        sa.Column("resolution", sa.String(20), nullable=True),
        sa.Column("series_type", sa.String(20), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["activity_id"], ["activities.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("activity_id", "stream_type", name="uq_streams_activity_type"),
    )

    op.create_table(
        "sync_state",
        sa.Column("athlete_id", sa.BigInteger(), nullable=False),
        sa.Column("last_full_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_incremental_sync", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sync_status", sa.String(20), nullable=False, server_default="idle"),
        sa.Column("activities_synced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["athlete_id"], ["athletes.id"]),
        sa.PrimaryKeyConstraint("athlete_id"),
    )


def downgrade() -> None:
    op.drop_table("sync_state")
    op.drop_table("activity_streams")
    op.drop_index("idx_activities_sport_type", "activities")
    op.drop_index("idx_activities_start_date", "activities")
    op.drop_index("idx_activities_athlete_id", "activities")
    op.drop_table("activities")
    op.drop_table("athletes")
