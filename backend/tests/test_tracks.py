"""Tests for /api/tracks/* endpoints: prerequisite enforcement, progress rollup."""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ctf import CtfCategory, CtfChallenge, CtfScoring
from app.models.lesson import Lesson, LessonCategory, LessonLevel
from app.models.problem import Problem, Visibility
from app.models.track import Track, TrackItem, TrackOlympiad
from app.models.user import User, UserRole
from app.security import hash_flag, hash_password

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


async def _make_track(
    db: AsyncSession,
    author_id: uuid.UUID | None,
    slug: str = "oni-prep",
    olympiad: TrackOlympiad = TrackOlympiad.ONI,
    published: bool = True,
) -> Track:
    track = Track(
        slug=slug,
        title="ONI Prep",
        olympiad=olympiad,
        description_md="Prep track",
        published=published,
        created_by=author_id,
    )
    db.add(track)
    await db.commit()
    await db.refresh(track)
    return track


async def _make_lesson(db: AsyncSession, slug: str = "lesson-1") -> Lesson:
    lesson = Lesson(
        slug=slug,
        title="Lesson One",
        category=LessonCategory.basics,
        level=LessonLevel.beginner,
        published=True,
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


async def _make_problem(db: AsyncSession, slug: str = "problem-1") -> Problem:
    from datetime import UTC, datetime

    problem = Problem(
        slug=slug,
        title="Problem One",
        statement_md="Statement",
        input_format="",
        output_format="",
        difficulty=3,
        visibility=Visibility.public,
        updated_at=datetime.now(UTC),
    )
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


async def _make_ctf_challenge(db: AsyncSession, slug: str = "ctf-1") -> CtfChallenge:
    challenge = CtfChallenge(
        slug=slug,
        title="CTF One",
        statement_md="Find the flag",
        category=CtfCategory.misc,
        difficulty=2,
        base_points=100,
        scoring=CtfScoring.static,
        flag_hash=hash_flag("reinfo{track}", True),
        flag_case_sensitive=True,
        published=True,
    )
    db.add(challenge)
    await db.commit()
    await db.refresh(challenge)
    return challenge


async def _make_item(
    db: AsyncSession,
    track: Track,
    ref_id: uuid.UUID,
    item_type: str,
    order: int = 0,
    prerequisite_item_id: uuid.UUID | None = None,
) -> TrackItem:
    item = TrackItem(
        track_id=track.id,
        item_type=item_type,
        ref_id=ref_id,
        order=order,
        prerequisite_item_id=prerequisite_item_id,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@pytest.mark.asyncio
async def test_prerequisite_blocks_progress(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "track-teacher1", UserRole.teacher)
    await _make_user(db_session, "track-student1")
    track = await _make_track(db_session, teacher.id, slug="prereq-track")
    lesson = await _make_lesson(db_session, slug="prereq-lesson")
    problem = await _make_problem(db_session, slug="prereq-problem")

    item1 = await _make_item(db_session, track, lesson.id, "lesson", order=0)
    item2 = await _make_item(
        db_session, track, problem.id, "problem", order=1, prerequisite_item_id=item1.id
    )

    await _login(client, "track-student1")

    r = await client.put(
        f"/api/tracks/{track.slug}/items/{item2.id}/progress", json={"status": "in_progress"}
    )
    assert r.status_code == 400

    r = await client.put(
        f"/api/tracks/{track.slug}/items/{item1.id}/progress", json={"status": "done"}
    )
    assert r.status_code == 200
    assert r.json()["unlock_status"] == "done"

    r2 = await client.put(
        f"/api/tracks/{track.slug}/items/{item2.id}/progress", json={"status": "in_progress"}
    )
    assert r2.status_code == 200
    assert r2.json()["status"] == "in_progress"


@pytest.mark.asyncio
async def test_unlock_status_in_detail_response(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "track-teacher2", UserRole.teacher)
    await _make_user(db_session, "track-student2")
    track = await _make_track(db_session, teacher.id, slug="unlock-track")
    lesson = await _make_lesson(db_session, slug="unlock-lesson")
    problem = await _make_problem(db_session, slug="unlock-problem")

    item1 = await _make_item(db_session, track, lesson.id, "lesson", order=0)
    await _make_item(
        db_session, track, problem.id, "problem", order=1, prerequisite_item_id=item1.id
    )

    await _login(client, "track-student2")
    r = await client.get(f"/api/tracks/{track.slug}")
    assert r.status_code == 200
    items = r.json()["items"]
    assert items[0]["unlock_status"] == "available"
    assert items[1]["unlock_status"] == "locked"
    assert items[1]["ref_title"] == "Problem One"


@pytest.mark.asyncio
async def test_progress_rollup(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "track-teacher3", UserRole.teacher)
    await _make_user(db_session, "track-student3")
    track = await _make_track(db_session, teacher.id, slug="rollup-track")
    lesson = await _make_lesson(db_session, slug="rollup-lesson")
    problem = await _make_problem(db_session, slug="rollup-problem")

    item1 = await _make_item(db_session, track, lesson.id, "lesson", order=0)
    await _make_item(db_session, track, problem.id, "problem", order=1)

    await _login(client, "track-student3")

    r0 = await client.get("/api/tracks")
    entry0 = next(t for t in r0.json()["items"] if t["slug"] == "rollup-track")
    assert entry0["completion_pct"] == 0.0
    assert entry0["item_count"] == 2

    await client.put(f"/api/tracks/{track.slug}/items/{item1.id}/progress", json={"status": "done"})

    r1 = await client.get("/api/tracks")
    entry1 = next(t for t in r1.json()["items"] if t["slug"] == "rollup-track")
    assert entry1["completion_pct"] == 50.0
    assert entry1["completed_items"] == 1

    detail = await client.get(f"/api/tracks/{track.slug}")
    assert detail.json()["completion_pct"] == 50.0


@pytest.mark.asyncio
async def test_ctf_challenge_item_resolves(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "track-teacher4", UserRole.teacher)
    track = await _make_track(db_session, teacher.id, slug="ctf-track")
    challenge = await _make_ctf_challenge(db_session, slug="track-ctf")
    await _make_item(db_session, track, challenge.id, "ctf_challenge", order=0)

    r = await client.get(f"/api/tracks/{track.slug}")
    assert r.status_code == 200
    item = r.json()["items"][0]
    assert item["ref_title"] == "CTF One"
    assert item["ref_slug"] == "track-ctf"
    assert item["item_type"] == "ctf_challenge"


@pytest.mark.asyncio
async def test_create_item_rejects_nonexistent_ref(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "track-teacher5", UserRole.teacher)
    track = await _make_track(db_session, teacher.id, slug="bad-ref-track")
    await _login(client, "track-teacher5")

    r = await client.post(
        f"/api/tracks/{track.slug}/items",
        json={"item_type": "lesson", "ref_id": str(uuid.uuid4()), "order": 0},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_prerequisite_cycle_rejected(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "track-teacher6", UserRole.teacher)
    track = await _make_track(db_session, teacher.id, slug="cycle-track")
    lesson = await _make_lesson(db_session, slug="cycle-lesson")
    problem = await _make_problem(db_session, slug="cycle-problem")

    item1 = await _make_item(db_session, track, lesson.id, "lesson", order=0)
    item2 = await _make_item(
        db_session, track, problem.id, "problem", order=1, prerequisite_item_id=item1.id
    )

    await _login(client, "track-teacher6")
    r = await client.patch(
        f"/api/tracks/{track.slug}/items/{item1.id}", json={"prerequisite_item_id": str(item2.id)}
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_unpublished_track_hidden_from_students(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    teacher = await _make_user(db_session, "track-teacher7", UserRole.teacher)
    await _make_user(db_session, "track-student7")
    track = await _make_track(db_session, teacher.id, slug="draft-track", published=False)

    r = await client.get(f"/api/tracks/{track.slug}")
    assert r.status_code == 404

    await _login(client, "track-student7")
    r2 = await client.get(f"/api/tracks/{track.slug}")
    assert r2.status_code == 404

    await _login(client, "track-teacher7")
    r3 = await client.get(f"/api/tracks/{track.slug}")
    assert r3.status_code == 200


@pytest.mark.asyncio
async def test_student_cannot_create_track(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "track-student8")
    await _login(client, "track-student8")

    r = await client.post(
        "/api/tracks",
        json={"slug": "student-track", "title": "Nope", "olympiad": "ONI"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_teacher_can_create_and_author_track(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "track-teacher8", UserRole.teacher)
    await _login(client, "track-teacher8")

    r = await client.post(
        "/api/tracks",
        json={"slug": "teacher-track", "title": "Teacher Track", "olympiad": "CTF"},
    )
    assert r.status_code == 201
    assert r.json()["olympiad"] == "CTF"
