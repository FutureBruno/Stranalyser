from datetime import datetime
from sqlalchemy import BigInteger, String, Text, DateTime, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SyncState(Base):
    __tablename__ = "sync_state"

    athlete_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("athletes.id"), primary_key=True
    )
    last_full_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_incremental_sync: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sync_status: Mapped[str] = mapped_column(String(20), default="idle", nullable=False)
    activities_synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    error_message: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    athlete: Mapped["Athlete"] = relationship(back_populates="sync_state")
