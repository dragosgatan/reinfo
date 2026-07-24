"""schemas for social features: friends, notifications, activity feed"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.social import FriendRequestStatus, NotificationType


class UserOnlineStatus(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    online: bool
    last_active_at: datetime


class FriendRequestRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    status: FriendRequestStatus
    created_at: datetime
    sender_username: str
    sender_display_name: str
    sender_avatar_url: str | None


class FriendshipRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    friend_id: uuid.UUID
    friend_username: str
    friend_display_name: str
    friend_avatar_url: str | None
    online: bool
    last_active_at: datetime
    created_at: datetime


class NotificationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    type: NotificationType
    payload: str
    read: bool
    created_at: datetime


class ActivityFeedItem(BaseModel):
    submission_id: uuid.UUID
    user_id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    problem_slug: str
    problem_title: str
    verdict: str
    score: int
    language: str
    created_at: datetime


class FriendStatusResponse(BaseModel):
    """friendship status between current user and a target user"""

    is_friend: bool
    pending_sent: bool
    pending_received: bool
    request_id: uuid.UUID | None
