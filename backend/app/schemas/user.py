import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.user import UserRole

_USERNAME_PATTERN = r"^[a-zA-Z0-9_]+$"
_EMAIL_PATTERN = r"^[^\s@]+@[^\s@]+\.[^\s@]+$"

AppTheme = Literal["light", "dark", "ocean", "teal", "high-contrast"]


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=20, pattern=_USERNAME_PATTERN)
    email: str = Field(max_length=256, pattern=_EMAIL_PATTERN)
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1, max_length=128)
    language: str = Field(default="ro", max_length=8)


class LoginRequest(BaseModel):
    username: str
    password: str


class ForgotPasswordRequest(BaseModel):
    email: str = Field(max_length=256, pattern=_EMAIL_PATTERN)


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8)


class VerifyEmailRequest(BaseModel):
    token: str


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=128)
    avatar_url: str | None = Field(default=None, max_length=512)
    bio: str | None = None
    language: str | None = Field(default=None, max_length=8)


class UserProfileUpdate(BaseModel):
    """editable profile fields for the authenticated user"""

    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    bio: str | None = Field(default=None, max_length=2000)
    language: str | None = Field(default=None, max_length=8)
    theme: AppTheme | None = None
    privacy_show_email: bool | None = None
    privacy_show_activity: bool | None = None
    privacy_show_solved: bool | None = None
    github_url: str | None = Field(default=None, max_length=256)
    link_1: str | None = Field(default=None, max_length=256)
    link_2: str | None = Field(default=None, max_length=256)
    link_3: str | None = Field(default=None, max_length=256)


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
    theme: str | None
    is_verified: bool
    privacy_show_email: bool
    privacy_show_activity: bool
    privacy_show_solved: bool
    github_url: str | None
    link_1: str | None
    link_2: str | None
    link_3: str | None


class UserPublic(BaseModel):
    """minimal profile visible to other users"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    role: UserRole
    created_at: datetime


class UserProfileRead(BaseModel):
    """full public profile including duel stats"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    bio: str | None
    role: UserRole
    created_at: datetime
    last_active_at: datetime
    duel_rating: int
    duel_wins: int
    duel_losses: int
    duel_draws: int
    contest_rating: int
    github_url: str | None
    link_1: str | None
    link_2: str | None
    link_3: str | None
    privacy_show_email: bool
    email: str | None


class ExternalResultCreate(BaseModel):
    contest_name: str = Field(min_length=1, max_length=256)
    platform: str = Field(min_length=1, max_length=128)
    result_text: str = Field(min_length=1, max_length=256)
    year: int = Field(ge=2000, le=2100)


class ExternalResultRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    contest_name: str
    platform: str
    result_text: str
    year: int
    verified: bool
    verified_by_id: uuid.UUID | None
    created_at: datetime


class ActivityDay(BaseModel):
    date: str
    count: int


class DifficultyDistribution(BaseModel):
    easy: int
    medium: int
    hard: int


class UserStatsRead(BaseModel):
    total_solved: int
    total_submissions: int
    difficulty_distribution: DifficultyDistribution
    achievements: list[str]
    problem_score: int = 0


class AchievementInfo(BaseModel):
    key: str
    label: str
    description: str


class ProblemsLeaderboardEntry(BaseModel):
    rank: int
    username: str
    display_name: str
    avatar_url: str | None
    problem_score: int
    total_solved: int
    solved_easy: int
    solved_medium: int
    solved_hard: int


class AdminUserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    email: str
    display_name: str
    avatar_url: str | None
    role: UserRole
    is_banned: bool
    created_at: datetime
    last_active_at: datetime


class AdminUserList(BaseModel):
    total: int
    users: list[AdminUserRead]


class AdminRoleUpdate(BaseModel):
    role: UserRole


class AdminBanUpdate(BaseModel):
    is_banned: bool


class AdminStats(BaseModel):
    total_users: int
    total_problems: int
    total_submissions: int
    total_contests: int
    users_by_role: dict[str, int]


class DuelLeaderboardEntry(BaseModel):
    rank: int
    username: str
    display_name: str
    avatar_url: str | None
    duel_rating: int
    duel_wins: int
    duel_losses: int
    duel_draws: int
