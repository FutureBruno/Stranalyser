from datetime import datetime
from typing import Any
from sqlalchemy import BigInteger, String, Text, DateTime, Float, Integer, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB, ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    athlete_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("athletes.id"), nullable=False, index=True)

    name: Mapped[str | None] = mapped_column(Text)
    sport_type: Mapped[str | None] = mapped_column(String(50), index=True)
    type: Mapped[str | None] = mapped_column(String(50))

    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    start_date_local: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    timezone: Mapped[str | None] = mapped_column(String(100))

    distance: Mapped[float | None] = mapped_column(Float)
    moving_time: Mapped[int | None] = mapped_column(Integer)
    elapsed_time: Mapped[int | None] = mapped_column(Integer)
    total_elevation_gain: Mapped[float | None] = mapped_column(Float)

    average_speed: Mapped[float | None] = mapped_column(Float)
    max_speed: Mapped[float | None] = mapped_column(Float)
    average_heartrate: Mapped[float | None] = mapped_column(Float)
    max_heartrate: Mapped[float | None] = mapped_column(Float)
    average_watts: Mapped[float | None] = mapped_column(Float)
    average_cadence: Mapped[float | None] = mapped_column(Float)
    suffer_score: Mapped[int | None] = mapped_column(Integer)

    kudos_count: Mapped[int | None] = mapped_column(Integer)
    achievement_count: Mapped[int | None] = mapped_column(Integer)

    map_id: Mapped[str | None] = mapped_column(String(50))
    polyline: Mapped[str | None] = mapped_column(Text)

    start_latlng: Mapped[list[float] | None] = mapped_column(ARRAY(Float))
    end_latlng: Mapped[list[float] | None] = mapped_column(ARRAY(Float))

    workout_type: Mapped[int | None] = mapped_column(Integer)
    description: Mapped[str | None] = mapped_column(Text)
    gear_id: Mapped[str | None] = mapped_column(String(50))

    trainer: Mapped[bool | None] = mapped_column(Boolean)
    commute: Mapped[bool | None] = mapped_column(Boolean)
    manual: Mapped[bool | None] = mapped_column(Boolean)
    private: Mapped[bool | None] = mapped_column(Boolean)
    flagged: Mapped[bool | None] = mapped_column(Boolean)

    raw: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    streams_fetched: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    athlete: Mapped["Athlete"] = relationship(back_populates="activities")
    streams: Mapped[list["ActivityStream"]] = relationship(
        back_populates="activity", cascade="all, delete-orphan", lazy="select"
    )


class ActivityStream(Base):
    __tablename__ = "activity_streams"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    activity_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("activities.id", ondelete="CASCADE"), nullable=False
    )
    stream_type: Mapped[str] = mapped_column(String(50), nullable=False)
    data: Mapped[list[Any]] = mapped_column(JSONB, nullable=False)
    original_size: Mapped[int | None] = mapped_column(Integer)
    resolution: Mapped[str | None] = mapped_column(String(20))
    series_type: Mapped[str | None] = mapped_column(String(20))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    activity: Mapped["Activity"] = relationship(back_populates="streams")
