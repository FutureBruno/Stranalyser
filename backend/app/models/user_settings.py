from datetime import datetime
from sqlalchemy import BigInteger, String, Text, DateTime, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserSettings(Base):
    __tablename__ = "user_settings"

    athlete_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("athletes.id", ondelete="CASCADE"), primary_key=True
    )
    anthropic_api_key: Mapped[str | None] = mapped_column(Text)
    google_api_key: Mapped[str | None] = mapped_column(Text)
    preferred_provider: Mapped[str | None] = mapped_column(String(50))
    preferred_model: Mapped[str | None] = mapped_column(String(100))

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    athlete: Mapped["Athlete"] = relationship(back_populates="settings", lazy="select")
