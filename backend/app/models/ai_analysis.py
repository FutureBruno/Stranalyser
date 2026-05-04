from datetime import datetime
from typing import Any

from sqlalchemy import BigInteger, String, Integer, DateTime, Date, ForeignKey, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class AIAnalysis(Base):
    __tablename__ = "ai_analyses"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    athlete_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("athletes.id"), nullable=False, index=True)

    # 'weekly_report' or 'activity_analysis'
    analysis_type: Mapped[str] = mapped_column(String(50), nullable=False)

    # For activity analyses: the activity ID
    activity_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("activities.id", ondelete="SET NULL"), nullable=True, index=True)

    # For weekly reports: ISO week string like "2026-W18"
    week_key: Mapped[str | None] = mapped_column(String(10), nullable=True, index=True)

    # Structured AI response
    content: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)

    # Token usage
    input_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    output_tokens: Mapped[int | None] = mapped_column(Integer, nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    athlete: Mapped["Athlete"] = relationship(back_populates="ai_analyses")
