import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(max_length=256)
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=128)
    language: str = Field(default="ro", max_length=8)


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=128)
    avatar_url: str | None = Field(default=None, max_length=512)
    bio: str | None = None
    language: str | None = Field(default=None, max_length=8)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    role: UserRole
    display_name: str
    avatar_url: str | None
    bio: str | None
    created_at: datetime
    last_active_at: datetime
    language: str


class UserPublic(BaseModel):
    """Minimal profile visible to other users."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    role: UserRole
    created_at: datetime
