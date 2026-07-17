"""Roadmap, RoadmapNode, RoadmapEdge, and UserRoadmapProgress models."""

import uuid
from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.user import User


class NodeStatus(StrEnum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"


class NodeLinkType(StrEnum):
    problem = "problem"
    material = "material"
    external = "external"


class Roadmap(Base, TimestampMixin):
    __tablename__ = "roadmaps"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    slug: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    icon: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_published: Mapped[bool] = mapped_column(nullable=False, server_default=text("false"))
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )

    nodes: Mapped[list["RoadmapNode"]] = relationship(
        "RoadmapNode", back_populates="roadmap", cascade="all, delete-orphan"
    )
    edges: Mapped[list["RoadmapEdge"]] = relationship(
        "RoadmapEdge", back_populates="roadmap", cascade="all, delete-orphan"
    )


class RoadmapNode(Base, TimestampMixin):
    __tablename__ = "roadmap_nodes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    roadmap_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="SET NULL"), nullable=True, index=True
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    order: Mapped[int] = mapped_column(Integer, nullable=False, server_default=text("0"))
    x: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0"))
    y: Mapped[float] = mapped_column(Float, nullable=False, server_default=text("0"))

    roadmap: Mapped["Roadmap"] = relationship("Roadmap", back_populates="nodes")
    parent: Mapped["RoadmapNode | None"] = relationship(
        "RoadmapNode",
        remote_side="RoadmapNode.id",
        back_populates="children",
        foreign_keys="RoadmapNode.parent_id",
    )
    children: Mapped[list["RoadmapNode"]] = relationship(
        "RoadmapNode",
        back_populates="parent",
        foreign_keys="RoadmapNode.parent_id",
    )
    links: Mapped[list["RoadmapNodeLink"]] = relationship(
        "RoadmapNodeLink", back_populates="node", cascade="all, delete-orphan"
    )
    progress: Mapped[list["UserRoadmapProgress"]] = relationship(
        "UserRoadmapProgress", back_populates="node", cascade="all, delete-orphan"
    )


class RoadmapNodeLink(Base):
    __tablename__ = "roadmap_node_links"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(512), nullable=False)
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    link_type: Mapped[NodeLinkType] = mapped_column(
        Enum(NodeLinkType, name="node_link_type"), nullable=False
    )
    problem_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("problems.id", ondelete="SET NULL"), nullable=True, index=True
    )

    node: Mapped["RoadmapNode"] = relationship("RoadmapNode", back_populates="links")


class RoadmapEdge(Base):
    __tablename__ = "roadmap_edges"
    __table_args__ = (UniqueConstraint("from_node_id", "to_node_id", name="uq_roadmap_edge"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    roadmap_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmaps.id", ondelete="CASCADE"), nullable=False, index=True
    )
    from_node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    to_node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )

    roadmap: Mapped["Roadmap"] = relationship("Roadmap", back_populates="edges")
    from_node: Mapped["RoadmapNode"] = relationship("RoadmapNode", foreign_keys=[from_node_id])
    to_node: Mapped["RoadmapNode"] = relationship("RoadmapNode", foreign_keys=[to_node_id])


class UserRoadmapProgress(Base):
    __tablename__ = "user_roadmap_progress"
    __table_args__ = (UniqueConstraint("user_id", "node_id", name="uq_user_node_progress"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    node_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("roadmap_nodes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    status: Mapped[NodeStatus] = mapped_column(
        Enum(NodeStatus, name="node_status"),
        nullable=False,
        server_default=text("'not_started'"),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    user: Mapped["User"] = relationship("User")
    node: Mapped["RoadmapNode"] = relationship("RoadmapNode", back_populates="progress")
