"""aichatusage (per-request usage/cost log) and aichatcache; see app.ai_chat for the logic that reads and writes these"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, new_uuid


class AiChatUsage(Base):
    """one row per lesson-chat request, real model calls and cache hits alike"""

    __tablename__ = "ai_chat_usage"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    lesson_slug: Mapped[str] = mapped_column(String(128), nullable=False)
    prompt_tokens: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    completion_tokens: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("0")
    )
    cache_hit: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )


class AiChatCache(Base):
    """cached final response text keyed by (lesson_slug, normalized latest message), ignores earlier conversation turns"""

    __tablename__ = "ai_chat_cache"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    cache_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    lesson_slug: Mapped[str] = mapped_column(String(128), nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )
