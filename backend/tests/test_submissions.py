"""Tests for submission API endpoints."""

import uuid
from io import BytesIO

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import ComparisonMode, Problem, TestCase, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.security import hash_password
from app.storage import save_test_case

_PASSWORD = "testpassword1"
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
async def _make_problem(
    db: AsyncSession,
    author_id: uuid.UUID | None = None,
    slug: str = "test-prob",
    visibility: Visibility = Visibility.public,
    comparison_mode: ComparisonMode = ComparisonMode.exact,
) -> Problem:
    from datetime import UTC, datetime

    p = Problem(
        slug=slug,
        title="Test Problem",
        statement_md="Statement",
        input_format="Input",
        output_format="Output",
        difficulty=3,
        author_id=author_id,
        visibility=visibility,
        updated_at=datetime.now(UTC),
        comparison_mode=comparison_mode,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p
async def _make_test_case(
    db: AsyncSession,
    problem_id: uuid.UUID,
    ordinal: int = 1,
    expected_output: bytes = b"42\n",
    score: int = 10,
    is_sample: bool = False,
) -> TestCase:
    in_path, out_path = await save_test_case(problem_id, ordinal, b"input\n", expected_output)
    tc = TestCase(
        problem_id=problem_id,
        ordinal=ordinal,
        input_path=in_path,
        output_path=out_path,
        score=score,
        is_sample=is_sample,
        is_hidden=not is_sample,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc
def _output_file(content: bytes = b"42\n") -> dict:
    return {"output_file": ("answer.out", BytesIO(content), "text/plain")}
@pytest.mark.asyncio
async def test_submit_ac(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "submitter1")
    problem = await _make_problem(db_session, user.id, slug="sub-ac")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)
    await _login(client, "submitter1")

    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file(b"42\n"))
    assert r.status_code == 201
    body = r.json()
    assert body["verdict"] == "AC"
    assert body["score"] == 10
    assert body["judged_at"] is not None
    assert "results" in body
    assert len(body["results"]) == 1
    assert body["results"][0]["verdict"] == "AC"
@pytest.mark.asyncio
async def test_submit_wa(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "submitter2")
    problem = await _make_problem(db_session, user.id, slug="sub-wa")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)
    await _login(client, "submitter2")

    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file(b"99\n"))
    assert r.status_code == 201
    body = r.json()
    assert body["verdict"] == "WA"
    assert body["score"] == 0
@pytest.mark.asyncio
async def test_submit_partial(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "submitter3")
    problem = await _make_problem(db_session, user.id, slug="sub-partial")
    await _make_test_case(db_session, problem.id, 1, b"42\n", score=10)
    await _make_test_case(db_session, problem.id, 2, b"999\n", score=20)
    await _login(client, "submitter3")

    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file(b"42\n"))
    assert r.status_code == 201
    body = r.json()
    assert body["verdict"] == "PARTIAL"
    assert body["score"] == 10
@pytest.mark.asyncio
async def test_submit_requires_auth(client: AsyncClient, db_session: AsyncSession) -> None:
    problem = await _make_problem(db_session, None, slug="sub-noauth")
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    assert r.status_code == 401
@pytest.mark.asyncio
async def test_submit_problem_not_found(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "sub-404")
    await _login(client, "sub-404")
    r = await client.post("/api/problems/nonexistent-prob/submit", files=_output_file())
    assert r.status_code == 404
@pytest.mark.asyncio
async def test_submit_private_problem_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await _make_user(db_session, "sub-owner", UserRole.teacher)
    other = await _make_user(db_session, "sub-other")
    problem = await _make_problem(db_session, owner.id, slug="sub-private", visibility=Visibility.private)
    await _login(client, "sub-other")

    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    assert r.status_code == 403
@pytest.mark.asyncio
async def test_submit_output_too_large(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "sub-large")
    problem = await _make_problem(db_session, user.id, slug="sub-large")
    await _login(client, "sub-large")

    big = b"x" * (10 * 1024 * 1024 + 1)
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file(big))
    assert r.status_code == 413
@pytest.mark.asyncio
async def test_submit_with_source_code(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "submitter-code")
    problem = await _make_problem(db_session, user.id, slug="sub-code")
    await _make_test_case(db_session, problem.id, 1, b"42\n")
    await _login(client, "submitter-code")

    files = {
        "output_file": ("answer.out", BytesIO(b"42\n"), "text/plain"),
        "source_code": ("sol.cpp", BytesIO(b'#include<bits/stdc++.h>'), "text/plain"),
    }
    data = {"language": "cpp"}
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=files, data=data)
    assert r.status_code == 201
    body = r.json()
    assert body["language"] == "cpp"
@pytest.mark.asyncio
async def test_submit_returns_submission_id(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "submitter-id")
    problem = await _make_problem(db_session, user.id, slug="sub-id")
    await _login(client, "submitter-id")

    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    assert r.status_code == 201
    assert "id" in r.json()
@pytest.mark.asyncio
async def test_get_submission_owner(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "get-sub-owner")
    problem = await _make_problem(db_session, user.id, slug="get-sub-prob")
    await _login(client, "get-sub-owner")

    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    sub_id = r.json()["id"]

    r2 = await client.get(f"/api/submissions/{sub_id}")
    assert r2.status_code == 200
    assert r2.json()["id"] == sub_id
@pytest.mark.asyncio
async def test_get_submission_problem_author(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "sub-teacher", UserRole.teacher)
    student = await _make_user(db_session, "sub-student")
    problem = await _make_problem(db_session, teacher.id, slug="sub-auth-prob")

    await _login(client, "sub-student")
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    sub_id = r.json()["id"]
    client.cookies.clear()

    await _login(client, "sub-teacher")
    r2 = await client.get(f"/api/submissions/{sub_id}")
    assert r2.status_code == 200
@pytest.mark.asyncio
async def test_get_submission_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    student = await _make_user(db_session, "sub-stu")
    await _make_user(db_session, "sub-adm", UserRole.admin)
    problem = await _make_problem(db_session, student.id, slug="sub-admin-prob")

    await _login(client, "sub-stu")
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    sub_id = r.json()["id"]
    client.cookies.clear()

    await _login(client, "sub-adm")
    r2 = await client.get(f"/api/submissions/{sub_id}")
    assert r2.status_code == 200
@pytest.mark.asyncio
async def test_get_submission_other_user_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    owner = await _make_user(db_session, "sub-real-owner")
    await _make_user(db_session, "sub-intruder")
    problem = await _make_problem(db_session, owner.id, slug="sub-protected")

    await _login(client, "sub-real-owner")
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    sub_id = r.json()["id"]
    client.cookies.clear()

    await _login(client, "sub-intruder")
    r2 = await client.get(f"/api/submissions/{sub_id}")
    assert r2.status_code == 403
@pytest.mark.asyncio
async def test_get_submission_anonymous_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "sub-anon-owner")
    problem = await _make_problem(db_session, user.id, slug="sub-anon-prob")

    await _login(client, "sub-anon-owner")
    r = await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    sub_id = r.json()["id"]
    client.cookies.clear()

    r2 = await client.get(f"/api/submissions/{sub_id}")
    assert r2.status_code == 403
@pytest.mark.asyncio
async def test_get_submission_not_found(client: AsyncClient) -> None:
    r = await client.get(f"/api/submissions/{uuid.uuid4()}")
    assert r.status_code == 404
@pytest.mark.asyncio
async def test_list_submissions_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/submissions")
    assert r.status_code == 401
@pytest.mark.asyncio
async def test_list_submissions_own(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "list-own")
    problem = await _make_problem(db_session, user.id, slug="list-own-prob")
    await _login(client, "list-own")

    for _ in range(3):
        await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())

    r = await client.get("/api/submissions")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 3
    assert len(body["items"]) == 3
    assert body["items"][0]["problem_slug"] == "list-own-prob"
@pytest.mark.asyncio
async def test_list_submissions_other_user_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    other = await _make_user(db_session, "list-other")
    await _make_user(db_session, "list-requester")
    await _login(client, "list-requester")

    r = await client.get(f"/api/submissions?user_id={other.id}")
    assert r.status_code == 403
@pytest.mark.asyncio
async def test_list_submissions_admin_filter_by_user(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    student = await _make_user(db_session, "list-stu")
    await _make_user(db_session, "list-adm", UserRole.admin)
    problem = await _make_problem(db_session, student.id, slug="list-adm-prob")

    await _login(client, "list-stu")
    await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    client.cookies.clear()

    await _login(client, "list-adm")
    r = await client.get(f"/api/submissions?user_id={student.id}")
    assert r.status_code == 200
    assert r.json()["total"] == 1
@pytest.mark.asyncio
async def test_list_submissions_filter_verdict(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "list-verdict")
    problem = await _make_problem(db_session, user.id, slug="list-verdict-prob")
    await _make_test_case(db_session, problem.id, 1, b"42\n")
    await _login(client, "list-verdict")

    await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file(b"42\n"))
    await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file(b"99\n"))

    r = await client.get("/api/submissions?verdict=AC")
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["verdict"] == "AC"
@pytest.mark.asyncio
async def test_list_submissions_filter_problem_slug(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    user = await _make_user(db_session, "list-slug")
    p1 = await _make_problem(db_session, user.id, slug="list-slug-p1")
    p2 = await _make_problem(db_session, user.id, slug="list-slug-p2")
    await _login(client, "list-slug")

    await client.post(f"/api/problems/{p1.slug}/submit", files=_output_file())
    await client.post(f"/api/problems/{p2.slug}/submit", files=_output_file())

    r = await client.get(f"/api/submissions?problem_slug={p1.slug}")
    assert r.status_code == 200
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["problem_slug"] == p1.slug
@pytest.mark.asyncio
async def test_list_submissions_pagination(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "list-page")
    problem = await _make_problem(db_session, user.id, slug="list-page-prob")
    await _login(client, "list-page")

    for _ in range(5):
        await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())

    r = await client.get("/api/submissions?per_page=2&page=1")
    body = r.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["pages"] == 3
@pytest.mark.asyncio
async def test_user_submissions_public(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "user-subs")
    problem = await _make_problem(db_session, user.id, slug="user-subs-prob")
    await _login(client, "user-subs")
    await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    client.cookies.clear()

    r = await client.get("/api/users/user-subs/submissions")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["problem_slug"] == "user-subs-prob"
@pytest.mark.asyncio
async def test_user_submissions_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/users/nonexistent-user-xyz/submissions")
    assert r.status_code == 404
@pytest.mark.asyncio
async def test_user_submissions_empty(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "user-empty-subs")
    r = await client.get("/api/users/user-empty-subs/submissions")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["items"] == []
@pytest.mark.asyncio
async def test_user_submissions_pagination(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "user-page-subs")
    problem = await _make_problem(db_session, user.id, slug="user-page-prob")
    await _login(client, "user-page-subs")

    for _ in range(4):
        await client.post(f"/api/problems/{problem.slug}/submit", files=_output_file())
    client.cookies.clear()

    r = await client.get("/api/users/user-page-subs/submissions?per_page=2&page=1")
    body = r.json()
    assert body["total"] == 4
    assert len(body["items"]) == 2
    assert body["pages"] == 2
