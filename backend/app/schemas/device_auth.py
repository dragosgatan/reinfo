import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DeviceStartResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri: str
    verification_uri_complete: str
    expires_in: int
    interval: int


class DevicePollRequest(BaseModel):
    device_code: str


class DevicePollResponse(BaseModel):
    status: Literal["pending", "approved", "denied", "expired"]
    token: str | None = None
    username: str | None = None


class DeviceCodeAction(BaseModel):
    user_code: str = Field(min_length=1, max_length=16)


class DeviceInfoResponse(BaseModel):
    valid: bool
    expires_at: datetime | None = None


class ApiTokenRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    label: str
    created_at: datetime
    last_used_at: datetime | None
    revoked_at: datetime | None
