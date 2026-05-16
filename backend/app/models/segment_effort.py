from datetime import datetime
from typing import Any
from sqlalchemy import BigInteger, String, Text, DateTime, Float, Integer, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SegmentEffort(Base):
    __tablename__ = "segment_efforts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)  # Strava effort ID
    activity_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False, index=True)
    athlete_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("athletes.id"), nullable=False, index=True)

    segment_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    segment_name: Mapped[str | None] = mapped_column(Text)
    sport_type: Mapped[str | None] = mapped_column(String(50), index=True)

    elapsed_time: Mapped[int | None] = mapped_column(Integer)   # seconds
    moving_time: Mapped[int | None] = mapped_column(Integer)
    distance: Mapped[float | None] = mapped_column(Float)       # meters

    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    start_date_local: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    pr_rank: Mapped[int | None] = mapped_column(Integer)        # 1 = PR
    kom_rank: Mapped[int | None] = mapped_column(Integer)

    average_watts: Mapped[float | None] = mapped_column(Float)
    average_heartrate: Mapped[float | None] = mapped_column(Float)
    average_cadence: Mapped[float | None] = mapped_column(Float)
    achievements: Mapped[list[Any] | None] = mapped_column(JSONB)

    polyline: Mapped[str | None] = mapped_column(Text)
    start_latlng: Mapped[list[float] | None] = mapped_column(JSONB)
    end_latlng: Mapped[list[float] | None] = mapped_column(JSONB)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    activity: Mapped["Activity"] = relationship(back_populates="segment_efforts")
