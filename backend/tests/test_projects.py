"""Tests for /api/projects/* endpoints: submissions, deadlines, class visibility, grading."""

import secrets
import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.classroom import Class, ClassMember
from app.models.project import Project
from app.models.user import User, UserRole
from app.security import hash_password

_PASSWORD = "testpassword1"


async def _make_user(db: AsyncSession, username: str, role: UserRole = UserRole.student) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(_PASSWORD),
        display_name=username,
        role=role,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _login(client: AsyncClient, username: str) -> None:
    r = await client.post("/api/auth/login", json={"username": username, "password": _PASSWORD})
    assert r.status_code == 200, r.text


async def _make_class(db: AsyncSession, teacher_id: uuid.UUID, name: str = "Class A") -> Class:
    cls = Class(name=name, teacher_id=teacher_id, join_code=secrets.token_hex(4))
    db.add(cls)
    await db.commit()
    await db.refresh(cls)
    return cls


async def _add_member(db: AsyncSession, class_id: uuid.UUID, user_id: uuid.UUID) -> None:
    db.add(ClassMember(class_id=class_id, user_id=user_id))
    await db.commit()


async def _make_project(
    db: AsyncSession,
    teacher_id: uuid.UUID | None,
    slug: str = "test-project",
    class_id: uuid.UUID | None = None,
    deadline: datetime | None = None,
    published: bool = True,
) -> Project:
    project = Project(
        slug=slug,
        title="Test Project",
        brief_md="Build something cool.",
        class_id=class_id,
        teacher_id=teacher_id,
        deadline=deadline,
        published=published,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@pytest.mark.asyncio
async def test_submit_and_resubmit(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "proj-teacher1", UserRole.teacher)
    await _make_user(db_session, "proj-student1")
    project = await _make_project(db_session, teacher.id, slug="submit-project")

    await _login(client, "proj-student1")

    r = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world", "notes_md": "v1"},
    )
    assert r.status_code == 201
    sub_id = r.json()["id"]
    assert r.json()["notes_md"] == "v1"

    r2 = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world-v2", "notes_md": "v2"},
    )
    assert r2.status_code == 201
    assert r2.json()["id"] == sub_id
    assert r2.json()["notes_md"] == "v2"
    assert r2.json()["repo_url"] == "https://github.com/octocat/hello-world-v2"


@pytest.mark.asyncio
async def test_invalid_repo_url_rejected(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "proj-teacher2", UserRole.teacher)
    await _make_user(db_session, "proj-student2")
    project = await _make_project(db_session, teacher.id, slug="bad-url-project")

    await _login(client, "proj-student2")
    r = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://gitlab.com/octocat/hello-world"},
    )
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_deadline_enforcement(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "proj-teacher3", UserRole.teacher)
    await _make_user(db_session, "proj-student3")
    past_deadline = datetime.now(UTC) - timedelta(days=1)
    project = await _make_project(
        db_session, teacher.id, slug="expired-project", deadline=past_deadline
    )

    await _login(client, "proj-student3")
    r = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world"},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_submit_before_deadline_allowed(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "proj-teacher4", UserRole.teacher)
    await _make_user(db_session, "proj-student4")
    future_deadline = datetime.now(UTC) + timedelta(days=1)
    project = await _make_project(
        db_session, teacher.id, slug="open-project", deadline=future_deadline
    )

    await _login(client, "proj-student4")
    r = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world"},
    )
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_class_scoped_project_visibility(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "proj-teacher5", UserRole.teacher)
    member = await _make_user(db_session, "proj-member5")
    await _make_user(db_session, "proj-outsider5")
    cls = await _make_class(db_session, teacher.id)
    await _add_member(db_session, cls.id, member.id)
    project = await _make_project(db_session, teacher.id, slug="class-project", class_id=cls.id)

    await _login(client, "proj-outsider5")
    r_outsider = await client.get(f"/api/projects/{project.slug}")
    assert r_outsider.status_code == 404

    r_outsider_submit = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world"},
    )
    assert r_outsider_submit.status_code == 404

    await _login(client, "proj-member5")
    r_member = await client.get(f"/api/projects/{project.slug}")
    assert r_member.status_code == 200

    r_member_submit = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world"},
    )
    assert r_member_submit.status_code == 201


@pytest.mark.asyncio
async def test_unpublished_project_hidden_from_students(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "proj-teacher6", UserRole.teacher)
    await _make_user(db_session, "proj-student6")
    project = await _make_project(db_session, teacher.id, slug="draft-project", published=False)

    await _login(client, "proj-student6")
    r = await client.get(f"/api/projects/{project.slug}")
    assert r.status_code == 404

    await _login(client, "proj-teacher6")
    r2 = await client.get(f"/api/projects/{project.slug}")
    assert r2.status_code == 200


@pytest.mark.asyncio
async def test_grading(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "proj-teacher7", UserRole.teacher)
    await _make_user(db_session, "proj-student7")
    project = await _make_project(db_session, teacher.id, slug="graded-project")

    await _login(client, "proj-student7")
    r = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world"},
    )
    sub_id = r.json()["id"]

    await _login(client, "proj-teacher7")
    r2 = await client.post(
        f"/api/projects/{project.slug}/submissions/{sub_id}/grade",
        json={"score": 88, "feedback_md": "Great work, minor style issues."},
    )
    assert r2.status_code == 200
    assert r2.json()["grade"]["score"] == 88

    await _login(client, "proj-student7")
    r3 = await client.get(f"/api/projects/{project.slug}")
    assert r3.json()["my_submission"]["grade"]["score"] == 88


@pytest.mark.asyncio
async def test_student_cannot_grade(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "proj-teacher8", UserRole.teacher)
    await _make_user(db_session, "proj-student8")
    project = await _make_project(db_session, teacher.id, slug="no-grade-project")

    await _login(client, "proj-student8")
    r = await client.post(
        f"/api/projects/{project.slug}/submissions",
        json={"repo_url": "https://github.com/octocat/hello-world"},
    )
    sub_id = r.json()["id"]

    r2 = await client.post(
        f"/api/projects/{project.slug}/submissions/{sub_id}/grade",
        json={"score": 100},
    )
    assert r2.status_code == 403


def _mock_response(status_code: int, json_data: dict | None = None, text: str = "", headers=None):
    resp = httpx.Response(
        status_code=status_code,
        json=json_data,
        text=text if json_data is None else None,
        headers=headers or {},
        request=httpx.Request("GET", "https://api.github.com/"),
    )
    return resp


@pytest.mark.asyncio
async def test_github_integration_happy_path(db_session: AsyncSession) -> None:
    from app.github_integration import get_repo_info

    async def fake_get(self, url, *args, **kwargs):
        if url.endswith("/readme"):
            return _mock_response(200, text="# Hello\nA readme.")
        if url.endswith("/commits"):
            return _mock_response(
                200,
                json_data=[{"commit": {"committer": {"date": "2026-01-01T00:00:00Z"}}}],
                headers={"Link": '<https://api.github.com/x?page=42>; rel="last"'},
            )
        return _mock_response(200, json_data={"language": "Python", "stargazers_count": 7})

    with (
        patch.object(settings, "enable_github_integration", True),
        patch("httpx.AsyncClient.get", new=fake_get),
    ):
        info = await get_repo_info(db_session, "https://github.com/octocat/hello-world")

    assert info is not None
    assert info.ok is True
    assert info.language == "Python"
    assert info.stars == 7
    assert info.commit_count_approx == 42
    assert info.readme_md is not None and "Hello" in info.readme_md


@pytest.mark.asyncio
async def test_github_integration_not_found_fallback(db_session: AsyncSession) -> None:
    from app.github_integration import get_repo_info

    async def fake_get(self, url, *args, **kwargs):
        return _mock_response(404)

    with (
        patch.object(settings, "enable_github_integration", True),
        patch("httpx.AsyncClient.get", new=fake_get),
    ):
        info = await get_repo_info(db_session, "https://github.com/octocat/private-repo")

    assert info is not None
    assert info.ok is False
    assert info.error_reason == "not_found"


@pytest.mark.asyncio
async def test_github_integration_rate_limited_fallback(db_session: AsyncSession) -> None:
    from app.github_integration import get_repo_info

    async def fake_get(self, url, *args, **kwargs):
        return _mock_response(403)

    with (
        patch.object(settings, "enable_github_integration", True),
        patch("httpx.AsyncClient.get", new=fake_get),
    ):
        info = await get_repo_info(db_session, "https://github.com/octocat/rate-limited")

    assert info is not None
    assert info.ok is False
    assert info.error_reason == "rate_limited"


@pytest.mark.asyncio
async def test_github_integration_disabled_returns_none(db_session: AsyncSession) -> None:
    from app.github_integration import get_repo_info

    with patch.object(settings, "enable_github_integration", False):
        info = await get_repo_info(db_session, "https://github.com/octocat/hello-world")

    assert info is None


@pytest.mark.asyncio
async def test_github_integration_network_error_never_raises(db_session: AsyncSession) -> None:
    from app.github_integration import get_repo_info

    mock_get = AsyncMock(side_effect=httpx.ConnectError("boom"))
    with (
        patch.object(settings, "enable_github_integration", True),
        patch("httpx.AsyncClient.get", new=mock_get),
    ):
        info = await get_repo_info(db_session, "https://github.com/octocat/unreachable")

    assert info is not None
    assert info.ok is False
    assert info.error_reason == "network_error"
