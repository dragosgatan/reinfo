"""track pydantic schemas"""

import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.models.track import TrackAudience, TrackItemStatus, TrackItemType, TrackOlympiad


class TrackItemRead(BaseModel):
    """a single track item with its resolved content title/slug and this user's status"""

    id: uuid.UUID
    item_type: TrackItemType
    ref_id: uuid.UUID
    ref_title: str
    ref_slug: str
    order: int
    prerequisite_item_id: uuid.UUID | None
    status: TrackItemStatus
    unlock_status: Literal["locked", "available", "done"]


class TrackItemCreate(BaseModel):
    item_type: TrackItemType
    ref_id: uuid.UUID
    order: int = Field(default=0, ge=0)
    prerequisite_item_id: uuid.UUID | None = None


class TrackItemUpdate(BaseModel):
    order: int | None = Field(default=None, ge=0)
    prerequisite_item_id: uuid.UUID | None = None
    clear_prerequisite: bool = False


class TrackSummary(BaseModel):
    """compact track info for the /api/tracks list"""

    id: uuid.UUID
    slug: str
    title: str
    olympiad: TrackOlympiad
    audience: TrackAudience
    order: int
    published: bool
    item_count: int
    completed_items: int
    completion_pct: float


class TrackDetail(TrackSummary):
    description_md: str | None
    items: list[TrackItemRead]


class TrackCreate(BaseModel):
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    title: str = Field(min_length=1, max_length=256)
    olympiad: TrackOlympiad
    audience: TrackAudience = TrackAudience.scoala
    description_md: str | None = None
    order: int = Field(default=0, ge=0)
    published: bool = False


class TrackUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    olympiad: TrackOlympiad | None = None
    audience: TrackAudience | None = None
    description_md: str | None = None
    order: int | None = Field(default=None, ge=0)
    published: bool | None = None


class TrackItemProgressUpdate(BaseModel):
    status: TrackItemStatus


class TrackListResponse(BaseModel):
    items: list[TrackSummary]
    total: int
