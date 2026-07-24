"""classroom models: classes, members, announcements, assignments, chat, dms"""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, new_uuid

if TYPE_CHECKING:
    from app.models.problem import Problem
    from app.models.user import User


class Class(Base, TimestampMixin):
    __tablename__ = "classes"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    join_code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    teacher_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    archived: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id])
    members: Mapped[list["ClassMember"]] = relationship(
        "ClassMember", back_populates="cls", cascade="all, delete-orphan"
    )
    announcements: Mapped[list["ClassAnnouncement"]] = relationship(
        "ClassAnnouncement", back_populates="cls", cascade="all, delete-orphan"
    )
    assignments: Mapped[list["ClassAssignment"]] = relationship(
        "ClassAssignment", back_populates="cls", cascade="all, delete-orphan"
    )
    homework: Mapped[list["ClassHomework"]] = relationship(
        "ClassHomework", back_populates="cls", cascade="all, delete-orphan"
    )
    messages: Mapped[list["ClassMessage"]] = relationship(
        "ClassMessage", back_populates="cls", cascade="all, delete-orphan"
    )


class ClassMember(Base):
    __tablename__ = "class_members"
    __table_args__ = (UniqueConstraint("class_id", "user_id", name="uq_class_member"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=text("now()"), nullable=False
    )

    cls: Mapped["Class"] = relationship("Class", back_populates="members")
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])


class ClassAnnouncement(Base, TimestampMixin):
    __tablename__ = "class_announcements"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    body_md: Mapped[str] = mapped_column(Text, nullable=False)
    pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    cls: Mapped["Class"] = relationship("Class", back_populates="announcements")
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])


class ClassHomework(Base, TimestampMixin):
    __tablename__ = "class_homework"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(256), nullable=False)
    description_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cls: Mapped["Class"] = relationship("Class", back_populates="homework")
    assignments: Mapped[list["ClassAssignment"]] = relationship(
        "ClassAssignment", back_populates="homework", cascade="all, delete-orphan"
    )


class ClassAssignment(Base, TimestampMixin):
    __tablename__ = "class_assignments"
    __table_args__ = (UniqueConstraint("class_id", "problem_id", name="uq_class_assignment"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    problem_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    homework_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("class_homework.id", ondelete="CASCADE"), nullable=True, index=True
    )
    note_md: Mapped[str | None] = mapped_column(Text, nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    cls: Mapped["Class"] = relationship("Class", back_populates="assignments")
    problem: Mapped["Problem"] = relationship("Problem", foreign_keys=[problem_id])
    homework: Mapped["ClassHomework | None"] = relationship(
        "ClassHomework", back_populates="assignments"
    )


class ClassMessage(Base, TimestampMixin):
    __tablename__ = "class_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    author_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)

    cls: Mapped["Class"] = relationship("Class", back_populates="messages")
    author: Mapped["User"] = relationship("User", foreign_keys=[author_id])


class DirectMessage(Base, TimestampMixin):
    __tablename__ = "direct_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_uuid)
    class_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    receiver_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    read: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default=text("false"))

    sender: Mapped["User"] = relationship("User", foreign_keys=[sender_id])
    receiver: Mapped["User"] = relationship("User", foreign_keys=[receiver_id])
