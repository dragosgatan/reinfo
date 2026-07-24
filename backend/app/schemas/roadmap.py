"""roadmap pydantic schemas"""

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.roadmap import NodeLinkType, NodeStatus


class NodeLinkRead(BaseModel):
    """a single resource link attached to a roadmap node"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    title: str
    link_type: NodeLinkType
    problem_id: uuid.UUID | None


class NodeLinkCreate(BaseModel):
    url: str = Field(min_length=1, max_length=512)
    title: str = Field(min_length=1, max_length=256)
    link_type: NodeLinkType
    problem_id: uuid.UUID | None = None


class ProgressRead(BaseModel):
    """user's progress record for a single node"""

    status: NodeStatus
    updated_at: datetime


class RoadmapNodeRead(BaseModel):
    """full node with resource links and merged user progress"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    roadmap_id: uuid.UUID
    parent_id: uuid.UUID | None
    title: str
    description: str | None
    order: int
    x: float
    y: float
    links: list[NodeLinkRead]
    progress: ProgressRead | None = None


class RoadmapNodeCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    order: int = Field(default=0, ge=0)
    x: float = Field(default=50.0, ge=0.0, le=100.0)
    y: float = Field(default=50.0, ge=0.0, le=100.0)


class RoadmapNodeUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    description: str | None = None
    parent_id: uuid.UUID | None = None
    order: int | None = Field(default=None, ge=0)
    x: float | None = Field(default=None, ge=0.0, le=100.0)
    y: float | None = Field(default=None, ge=0.0, le=100.0)


class RoadmapEdgeRead(BaseModel):
    """a directed prerequisite edge between two nodes"""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    from_node_id: uuid.UUID
    to_node_id: uuid.UUID


class RoadmapEdgeCreate(BaseModel):
    from_node_id: uuid.UUID
    to_node_id: uuid.UUID


class RoadmapSummary(BaseModel):
    """compact roadmap info for the /api/roadmaps list"""

    id: uuid.UUID
    title: str
    slug: str
    description: str | None
    icon: str | None
    is_published: bool
    total_nodes: int
    completed_nodes: int
    completion_pct: float


class RoadmapDetail(BaseModel):
    """full roadmap with all nodes and edges"""

    id: uuid.UUID
    title: str
    slug: str
    description: str | None
    icon: str | None
    is_published: bool
    nodes: list[RoadmapNodeRead]
    edges: list[RoadmapEdgeRead]


class RoadmapCreate(BaseModel):
    title: str = Field(min_length=1, max_length=256)
    slug: str = Field(min_length=1, max_length=128, pattern=r"^[a-z0-9-]+$")
    description: str | None = None
    icon: str | None = Field(default=None, max_length=64)
    is_published: bool = False


class RoadmapUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=256)
    description: str | None = None
    icon: str | None = Field(default=None, max_length=64)
    is_published: bool | None = None


class ProgressUpdate(BaseModel):
    status: NodeStatus


class RoadmapListResponse(BaseModel):
    items: list[RoadmapSummary]
    total: int
