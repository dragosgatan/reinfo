"""Tests for /api/lessons/* endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.lesson import Lesson, LessonCategory, LessonLevel
from app.models.user import User, UserRole
from app.security import hash_password

_PASSWORD = "testpassword1"

_LESSON_DATA = {
    "slug": "intro-python",
    "title": "Introducere în Python",
    "category": "basics",
    "level": "beginner",
    "content_md": "# Python\n\nFirst lesson.",
    "teacher_notes_md": "Teacher-only notes.",
    "quizzes": [
        {
            "id": "q1",
            "question": "Ce este Python?",
            "options": ["Un limbaj de programare", "Un șarpe", "Un framework", "Un editor"],
            "correct": 0,
            "explanation": "Python este un limbaj de programare interpretat.",
        }
    ],
    "ordinal": 1,
    "published": True,
}


async def _make_user(
    db: AsyncSession,
    username: str,
    role: UserRole = UserRole.student,
) -> User:
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


async def _make_lesson(
    db: AsyncSession,
    slug: str = "intro-python",
    published: bool = True,
    category: LessonCategory = LessonCategory.basics,
    level: LessonLevel = LessonLevel.beginner,
    ordinal: int = 0,
) -> Lesson:
    from datetime import UTC, datetime

    lesson = Lesson(
        slug=slug,
        title="Test Lesson",
        category=category,
        level=level,
        content_md="# Test\n\nContent here.",
        teacher_notes_md="Teacher notes.",
        quizzes=[],
        ordinal=ordinal,
        published=published,
        updated_at=datetime.now(UTC),
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


@pytest.mark.asyncio
async def test_list_lessons_anonymous(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_lesson(db_session, slug="pub-lesson", published=True)
    await _make_lesson(db_session, slug="draft-lesson", published=False)

    r = await client.get("/api/lessons")
    assert r.status_code == 200
    body = r.json()
    slugs = [item["slug"] for item in body["items"]]
    assert "pub-lesson" in slugs
    assert "draft-lesson" not in slugs


@pytest.mark.asyncio
async def test_list_lessons_teacher_sees_drafts(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "teacher1", role=UserRole.teacher)
    await _make_lesson(db_session, slug="pub2", published=True)
    await _make_lesson(db_session, slug="draft2", published=False)
    await _login(client, "teacher1")

    r = await client.get("/api/lessons")
    assert r.status_code == 200
    slugs = [item["slug"] for item in r.json()["items"]]
    assert "draft2" in slugs


@pytest.mark.asyncio
async def test_get_lesson_detail(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_lesson(db_session, slug="detail-test")

    r = await client.get("/api/lessons/detail-test")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "detail-test"
    assert "content_md" in body
    assert body["teacher_notes_md"] is None


@pytest.mark.asyncio
async def test_get_lesson_teacher_notes_hidden_for_student(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student1")
    await _make_lesson(db_session, slug="notes-test")
    await _login(client, "student1")

    r = await client.get("/api/lessons/notes-test")
    assert r.status_code == 200
    assert r.json()["teacher_notes_md"] is None


@pytest.mark.asyncio
async def test_get_lesson_teacher_notes_visible_for_teacher(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "teacher2", role=UserRole.teacher)
    await _make_lesson(db_session, slug="notes-teacher")
    await _login(client, "teacher2")

    r = await client.get("/api/lessons/notes-teacher")
    assert r.status_code == 200
    assert r.json()["teacher_notes_md"] == "Teacher notes."


@pytest.mark.asyncio
async def test_get_draft_lesson_anonymous_returns_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_lesson(db_session, slug="hidden-draft", published=False)

    r = await client.get("/api/lessons/hidden-draft")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_create_lesson_teacher(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher3", role=UserRole.teacher)
    await _login(client, "teacher3")

    r = await client.post("/api/lessons", json=_LESSON_DATA)
    assert r.status_code == 201
    body = r.json()
    assert body["slug"] == "intro-python"
    assert body["title"] == "Introducere în Python"


@pytest.mark.asyncio
async def test_create_lesson_student_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student2")
    await _login(client, "student2")

    r = await client.post("/api/lessons", json=_LESSON_DATA)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_create_lesson_duplicate_slug(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher4", role=UserRole.teacher)
    await _make_lesson(db_session, slug="intro-python")
    await _login(client, "teacher4")

    r = await client.post("/api/lessons", json=_LESSON_DATA)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_update_lesson(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher5", role=UserRole.teacher)
    await _make_lesson(db_session, slug="to-update")
    await _login(client, "teacher5")

    r = await client.patch("/api/lessons/to-update", json={"title": "Updated Title"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"


@pytest.mark.asyncio
async def test_delete_lesson_admin_only(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin1", role=UserRole.admin)
    await _make_lesson(db_session, slug="to-delete")
    await _login(client, "admin1")

    r = await client.delete("/api/lessons/to-delete")
    assert r.status_code == 200

    r2 = await client.get("/api/lessons/to-delete")
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_delete_lesson_teacher_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "teacher6", role=UserRole.teacher)
    await _make_lesson(db_session, slug="no-delete")
    await _login(client, "teacher6")

    r = await client.delete("/api/lessons/no-delete")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_mark_complete(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student3")
    await _make_lesson(db_session, slug="complete-me")
    await _login(client, "student3")

    r = await client.post("/api/lessons/complete-me/complete")
    assert r.status_code == 201

    r2 = await client.get("/api/lessons/complete-me")
    assert r2.json()["is_completed"] is True


@pytest.mark.asyncio
async def test_mark_complete_idempotent(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student4")
    await _make_lesson(db_session, slug="complete-idempotent")
    await _login(client, "student4")

    r1 = await client.post("/api/lessons/complete-idempotent/complete")
    r2 = await client.post("/api/lessons/complete-idempotent/complete")
    assert r1.status_code == 201
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_unmark_complete(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student5")
    await _make_lesson(db_session, slug="unmark-me")
    await _login(client, "student5")

    await client.post("/api/lessons/unmark-me/complete")
    r = await client.delete("/api/lessons/unmark-me/complete")
    assert r.status_code == 200

    r2 = await client.get("/api/lessons/unmark-me")
    assert r2.json()["is_completed"] is False


@pytest.mark.asyncio
async def test_list_lessons_filter_by_category(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_lesson(db_session, slug="basics-l", category=LessonCategory.basics)
    await _make_lesson(db_session, slug="graphs-l", category=LessonCategory.graphs)

    r = await client.get("/api/lessons?category=basics")
    assert r.status_code == 200
    slugs = [item["slug"] for item in r.json()["items"]]
    assert "basics-l" in slugs
    assert "graphs-l" not in slugs


@pytest.mark.asyncio
async def test_list_lessons_filter_by_level(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_lesson(db_session, slug="beg-l", level=LessonLevel.beginner)
    await _make_lesson(db_session, slug="adv-l", level=LessonLevel.advanced)

    r = await client.get("/api/lessons?level=beginner")
    assert r.status_code == 200
    slugs = [item["slug"] for item in r.json()["items"]]
    assert "beg-l" in slugs
    assert "adv-l" not in slugs


@pytest.mark.asyncio
async def test_mark_complete_anonymous_returns_401(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_lesson(db_session, slug="anon-complete")
    r = await client.post("/api/lessons/anon-complete/complete")
    assert r.status_code == 401
