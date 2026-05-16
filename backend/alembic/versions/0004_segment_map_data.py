"""segment map data: polyline, start/end latlng

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-16
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("segment_efforts", sa.Column("polyline", sa.Text(), nullable=True))
    op.add_column("segment_efforts", sa.Column("start_latlng", postgresql.JSONB(), nullable=True))
    op.add_column("segment_efforts", sa.Column("end_latlng", postgresql.JSONB(), nullable=True))
    # Reset segments_fetched so activities are re-fetched with map data
    op.execute("UPDATE activities SET segments_fetched = FALSE")


def downgrade() -> None:
    op.drop_column("segment_efforts", "end_latlng")
    op.drop_column("segment_efforts", "start_latlng")
    op.drop_column("segment_efforts", "polyline")
