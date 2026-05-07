"""Tests for /api/problems/* endpoints."""

import uuid
from io import BytesIO
from pathlib import Path

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.problem import Problem, TestCase, Visibility
from app.models.submission import Submission, Verdict
from app.models.user import User, UserRole
from app.security import hash_password

_PASSWORD = "testpassword1"


async def _make_user(
    db: AsyncSession,
    username: str,
    role: UserRole = UserRole.student,
    email: str | None = None,
) -> User:
    user = User(
        username=username,
        email=email or f"{username}@example.com",
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
    slug: str = "test-problem",
    visibility: Visibility = Visibility.public,
    difficulty: int = 3,
    tags: list[str] | None = None,
) -> Problem:
    problem = Problem(
        slug=slug,
        title="Test Problem",
        statement_md="# Test\n\nStatement.",
        input_format="One line with N.",
        output_format="One integer.",
        difficulty=difficulty,
        tags=tags or [],
        author_id=author_id,
        visibility=visibility,
        updated_at=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
    )
    db.add(problem)
    await db.commit()
    await db.refresh(problem)
    return problem


async def _make_test_case(
    db: AsyncSession,
    problem_id: uuid.UUID,
    ordinal: int = 1,
    is_sample: bool = True,
    is_hidden: bool = False,
    tmp_path: Path | None = None,
    input_bytes: bytes = b"1 2\n",
    output_bytes: bytes = b"3\n",
) -> TestCase:
    """Create a test case row with real files on disk."""
    from app.storage import save_test_case

    in_path, out_path = await save_test_case(problem_id, ordinal, input_bytes, output_bytes)
    tc = TestCase(
        problem_id=problem_id,
        ordinal=ordinal,
        input_path=in_path,
        output_path=out_path,
        score=10,
        is_sample=is_sample,
        is_hidden=is_hidden,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


def _upload_files(
    ordinal: int = 1,
    score: int = 10,
    is_sample: bool = False,
    is_hidden: bool = True,
    in_content: bytes = b"1 2\n",
    out_content: bytes = b"3\n",
) -> dict:
    return {
        "data": {
            "ordinal": str(ordinal),
            "score": str(score),
            "is_sample": str(is_sample).lower(),
            "is_hidden": str(is_hidden).lower(),
        },
        "files": {
            "input_file": ("1.in", BytesIO(in_content), "text/plain"),
            "output_file": ("1.out", BytesIO(out_content), "text/plain"),
        },
    }


@pytest.mark.asyncio
async def test_list_empty(client: AsyncClient) -> None:
    r = await client.get("/api/problems/")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 0
    assert body["items"] == []
    assert body["pages"] == 0


@pytest.mark.asyncio
async def test_list_public_problems(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "author1", UserRole.teacher)
    await _make_problem(db_session, author.id, slug="p1", visibility=Visibility.public)
    await _make_problem(db_session, author.id, slug="p2", visibility=Visibility.draft)

    r = await client.get("/api/problems/")
    assert r.status_code == 200
    body = r.json()
    # draft problem is hidden from anonymous users
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "p1"


@pytest.mark.asyncio
async def test_list_pagination(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "author2", UserRole.teacher)
    for i in range(5):
        await _make_problem(db_session, author.id, slug=f"prob-{i}")

    r = await client.get("/api/problems/?per_page=2&page=1")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 5
    assert len(body["items"]) == 2
    assert body["pages"] == 3

    r2 = await client.get("/api/problems/?per_page=2&page=3")
    assert len(r2.json()["items"]) == 1


@pytest.mark.asyncio
async def test_list_per_page_max(client: AsyncClient) -> None:
    r = await client.get("/api/problems/?per_page=51")
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_list_search(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "srch", UserRole.teacher)
    p = await _make_problem(db_session, author.id, slug="sortare")
    p.title = "Sortare rapidă"
    await db_session.commit()
    await _make_problem(db_session, author.id, slug="altfel")

    r = await client.get("/api/problems/?search=sortare")
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "sortare"


@pytest.mark.asyncio
async def test_list_tags_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "tags1", UserRole.teacher)
    await _make_problem(db_session, author.id, slug="p-graph-dp", tags=["graph", "dp"])
    await _make_problem(db_session, author.id, slug="p-graph", tags=["graph"])
    await _make_problem(db_session, author.id, slug="p-dp", tags=["dp"])

    r = await client.get("/api/problems/?tags=graph&tags=dp")
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "p-graph-dp"


@pytest.mark.asyncio
async def test_list_difficulty_filter(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "diff1", UserRole.teacher)
    await _make_problem(db_session, author.id, slug="easy", difficulty=2)
    await _make_problem(db_session, author.id, slug="medium", difficulty=5)
    await _make_problem(db_session, author.id, slug="hard", difficulty=9)

    r = await client.get("/api/problems/?difficulty_min=4&difficulty_max=6")
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["slug"] == "medium"


@pytest.mark.asyncio
async def test_list_status_requires_auth(client: AsyncClient) -> None:
    r = await client.get("/api/problems/?status=solved")
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_list_sort_hardest(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "sort1", UserRole.teacher)
    await _make_problem(db_session, author.id, slug="s-easy", difficulty=1)
    await _make_problem(db_session, author.id, slug="s-hard", difficulty=10)

    r = await client.get("/api/problems/?sort=hardest")
    items = r.json()["items"]
    assert items[0]["difficulty"] >= items[1]["difficulty"]


@pytest.mark.asyncio
async def test_list_sort_easiest(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "sort2", UserRole.teacher)
    await _make_problem(db_session, author.id, slug="se-easy", difficulty=1)
    await _make_problem(db_session, author.id, slug="se-hard", difficulty=10)

    r = await client.get("/api/problems/?sort=easiest")
    items = r.json()["items"]
    assert items[0]["difficulty"] <= items[1]["difficulty"]


@pytest.mark.asyncio
async def test_list_author_sees_own_drafts(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher-draft", UserRole.teacher)
    await _make_problem(db_session, teacher.id, slug="my-draft", visibility=Visibility.draft)
    await _login(client, "teacher-draft")

    r = await client.get("/api/problems/")
    assert any(i["slug"] == "my-draft" for i in r.json()["items"])


@pytest.mark.asyncio
async def test_list_admin_sees_all(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher-priv", UserRole.teacher)
    await _make_user(db_session, "admin-list", UserRole.admin)
    await _make_problem(db_session, teacher.id, slug="private-one", visibility=Visibility.private)

    await _login(client, "admin-list")
    r = await client.get("/api/problems/")
    assert any(i["slug"] == "private-one" for i in r.json()["items"])


@pytest.mark.asyncio
async def test_list_status_filter_solved(client: AsyncClient, db_session: AsyncSession) -> None:
    user = await _make_user(db_session, "solver1")
    problem = await _make_problem(db_session, None, slug="solved-one")
    sub = Submission(
        user_id=user.id,
        problem_id=problem.id,
        submitted_output_path="/tmp/x.out",
        verdict=Verdict.AC,
        score=100,
    )
    db_session.add(sub)
    await db_session.commit()

    await _login(client, "solver1")
    r = await client.get("/api/problems/?status=solved")
    body = r.json()
    assert body["total"] == 1
    assert body["items"][0]["user_status"] == "solved"


@pytest.mark.asyncio
async def test_list_user_status_none_when_anon(client: AsyncClient, db_session: AsyncSession) -> None:
    author = await _make_user(db_session, "anon-test", UserRole.teacher)
    await _make_problem(db_session, author.id, slug="anon-prob")

    r = await client.get("/api/problems/")
    assert r.json()["items"][0]["user_status"] is None


@pytest.mark.asyncio
async def test_list_solve_count(client: AsyncClient, db_session: AsyncSession) -> None:
    problem = await _make_problem(db_session, None, slug="popular")
    for i in range(3):
        u = await _make_user(db_session, f"solver-sc-{i}")
        db_session.add(
            Submission(
                user_id=u.id,
                problem_id=problem.id,
                submitted_output_path="/tmp/x.out",
                verdict=Verdict.AC,
                score=100,
            )
        )
    await db_session.commit()

    r = await client.get("/api/problems/")
    assert r.json()["items"][0]["solve_count"] == 3


@pytest.mark.asyncio
async def test_get_problem_success(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="detail-test")
    r = await client.get(f"/api/problems/{p.slug}")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "detail-test"
    assert "statement_md" in body
    assert "sample_test_cases" in body
    assert body["solve_count"] == 0


@pytest.mark.asyncio
async def test_get_problem_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/problems/nonexistent-slug")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_problem_draft_anonymous(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_problem(db_session, None, slug="draft-hidden", visibility=Visibility.draft)
    r = await client.get("/api/problems/draft-hidden")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_get_problem_draft_as_author(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "draft-author", UserRole.teacher)
    await _make_problem(db_session, teacher.id, slug="my-draft-detail", visibility=Visibility.draft)
    await _login(client, "draft-author")

    r = await client.get("/api/problems/my-draft-detail")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_get_problem_draft_as_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin-detail", UserRole.admin)
    await _make_problem(db_session, None, slug="draft-admin-sees", visibility=Visibility.draft)
    await _login(client, "admin-detail")

    r = await client.get("/api/problems/draft-admin-sees")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_get_problem_sample_test_cases(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="with-samples")
    await _make_test_case(db_session, p.id, ordinal=1, is_sample=True)
    await _make_test_case(db_session, p.id, ordinal=2, is_sample=False)

    r = await client.get(f"/api/problems/{p.slug}")
    assert r.status_code == 200
    samples = r.json()["sample_test_cases"]
    assert len(samples) == 1
    assert samples[0]["ordinal"] == 1


_PROBLEM_PAYLOAD: dict = {
    "slug": "new-problem",
    "title": "New Problem",
    "statement_md": "# Statement",
    "input_format": "N on first line.",
    "output_format": "One integer.",
    "difficulty": 4,
    "tags": ["graph"],
    "visibility": "draft",
}


@pytest.mark.asyncio
async def test_create_problem_teacher(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher-create", UserRole.teacher)
    await _login(client, "teacher-create")

    r = await client.post("/api/problems/", json=_PROBLEM_PAYLOAD)
    assert r.status_code == 201
    body = r.json()
    assert body["slug"] == "new-problem"
    assert body["author_id"] is not None


@pytest.mark.asyncio
async def test_create_problem_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin-create", UserRole.admin)
    await _login(client, "admin-create")

    r = await client.post("/api/problems/", json={**_PROBLEM_PAYLOAD, "slug": "admin-problem"})
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_create_problem_student_forbidden(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student-create", UserRole.student)
    await _login(client, "student-create")

    r = await client.post("/api/problems/", json=_PROBLEM_PAYLOAD)
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_create_problem_requires_auth(client: AsyncClient) -> None:
    r = await client.post("/api/problems/", json=_PROBLEM_PAYLOAD)
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_create_problem_duplicate_slug(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher-dup", UserRole.teacher)
    await _make_problem(db_session, teacher.id, slug="duplicate-slug")
    await _login(client, "teacher-dup")

    r = await client.post("/api/problems/", json={**_PROBLEM_PAYLOAD, "slug": "duplicate-slug"})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_create_problem_invalid_slug(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher-slug", UserRole.teacher)
    await _login(client, "teacher-slug")

    r = await client.post("/api/problems/", json={**_PROBLEM_PAYLOAD, "slug": "UPPERCASE_INVALID"})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_create_problem_invalid_difficulty(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "teacher-diff", UserRole.teacher)
    await _login(client, "teacher-diff")

    r = await client.post("/api/problems/", json={**_PROBLEM_PAYLOAD, "difficulty": 11})
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_update_problem_author(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher-patch", UserRole.teacher)
    await _make_problem(db_session, teacher.id, slug="editable")
    await _login(client, "teacher-patch")

    r = await client.patch("/api/problems/editable", json={"title": "Updated Title"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"


@pytest.mark.asyncio
async def test_update_problem_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher-patch2", UserRole.teacher)
    await _make_user(db_session, "admin-patch", UserRole.admin)
    await _make_problem(db_session, teacher.id, slug="editable-admin")
    await _login(client, "admin-patch")

    r = await client.patch("/api/problems/editable-admin", json={"difficulty": 7})
    assert r.status_code == 200
    assert r.json()["difficulty"] == 7


@pytest.mark.asyncio
async def test_update_problem_non_author_forbidden(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await _make_user(db_session, "owner", UserRole.teacher)
    await _make_user(db_session, "intruder", UserRole.teacher)
    await _make_problem(db_session, owner.id, slug="owners-problem")
    await _login(client, "intruder")

    r = await client.patch("/api/problems/owners-problem", json={"title": "Hacked"})
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_update_problem_not_found(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin-404", UserRole.admin)
    await _login(client, "admin-404")

    r = await client.patch("/api/problems/no-such-problem", json={"title": "X"})
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_update_problem_requires_auth(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_problem(db_session, None, slug="patch-noauth")
    r = await client.patch("/api/problems/patch-noauth", json={"title": "X"})
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_delete_problem_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin-del", UserRole.admin)
    await _make_problem(db_session, None, slug="to-delete")
    await _login(client, "admin-del")

    r = await client.delete("/api/problems/to-delete")
    assert r.status_code == 200

    # confirm it is now private (soft-deleted)
    await _login(client, "admin-del")
    detail = await client.get("/api/problems/to-delete")
    assert detail.status_code == 200
    assert detail.json()["visibility"] == "private"


@pytest.mark.asyncio
async def test_delete_problem_teacher_forbidden(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "teacher-del", UserRole.teacher)
    await _make_problem(db_session, teacher.id, slug="cant-delete")
    await _login(client, "teacher-del")

    r = await client.delete("/api/problems/cant-delete")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_delete_problem_not_found(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin-del2", UserRole.admin)
    await _login(client, "admin-del2")

    r = await client.delete("/api/problems/ghost-problem")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_upload_test_case_author(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "tc-author", UserRole.teacher)
    p = await _make_problem(db_session, teacher.id, slug="tc-prob")
    await _login(client, "tc-author")

    up = _upload_files(ordinal=1, is_sample=True, is_hidden=False)
    r = await client.post(f"/api/problems/{p.slug}/test-cases", data=up["data"], files=up["files"])
    assert r.status_code == 201
    body = r.json()
    assert body["ordinal"] == 1
    assert body["is_sample"] is True
    assert body["is_hidden"] is False
    assert body["input_path"].endswith("1.in")


@pytest.mark.asyncio
async def test_upload_test_case_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "tc-owner", UserRole.teacher)
    await _make_user(db_session, "tc-admin", UserRole.admin)
    p = await _make_problem(db_session, teacher.id, slug="tc-admin-prob")
    await _login(client, "tc-admin")

    up = _upload_files(ordinal=2)
    r = await client.post(f"/api/problems/{p.slug}/test-cases", data=up["data"], files=up["files"])
    assert r.status_code == 201


@pytest.mark.asyncio
async def test_upload_test_case_non_author_forbidden(client: AsyncClient, db_session: AsyncSession) -> None:
    owner = await _make_user(db_session, "tc-real-owner", UserRole.teacher)
    await _make_user(db_session, "tc-intruder", UserRole.teacher)
    p = await _make_problem(db_session, owner.id, slug="tc-protected")
    await _login(client, "tc-intruder")

    up = _upload_files()
    r = await client.post(f"/api/problems/{p.slug}/test-cases", data=up["data"], files=up["files"])
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_upload_test_case_requires_auth(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="tc-noauth")

    up = _upload_files()
    r = await client.post(f"/api/problems/{p.slug}/test-cases", data=up["data"], files=up["files"])
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_upload_test_case_not_found(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "tc-404", UserRole.admin)
    await _login(client, "tc-404")

    up = _upload_files()
    r = await client.post("/api/problems/no-problem/test-cases", data=up["data"], files=up["files"])
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_upload_test_case_overwrite(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "tc-overwrite", UserRole.teacher)
    p = await _make_problem(db_session, teacher.id, slug="tc-overwrite-prob")
    await _login(client, "tc-overwrite")

    up1 = _upload_files(ordinal=1, in_content=b"first\n")
    r1 = await client.post(f"/api/problems/{p.slug}/test-cases", data=up1["data"], files=up1["files"])
    assert r1.status_code == 201

    up2 = _upload_files(ordinal=1, in_content=b"second\n")
    r2 = await client.post(f"/api/problems/{p.slug}/test-cases", data=up2["data"], files=up2["files"])
    # same ordinal → update, not create
    assert r2.status_code == 201
    assert r2.json()["id"] == r1.json()["id"]


@pytest.mark.asyncio
async def test_upload_test_case_too_large(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "tc-large", UserRole.teacher)
    p = await _make_problem(db_session, teacher.id, slug="tc-large-prob")
    await _login(client, "tc-large")

    big = b"x" * (10 * 1024 * 1024 + 1)
    up = _upload_files(in_content=big)
    r = await client.post(f"/api/problems/{p.slug}/test-cases", data=up["data"], files=up["files"])
    assert r.status_code == 413


@pytest.mark.asyncio
async def test_download_sample_anonymous(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="dl-sample")
    await _make_test_case(db_session, p.id, ordinal=1, is_sample=True, input_bytes=b"1 2\n")

    r = await client.get(f"/api/problems/{p.slug}/input/1")
    assert r.status_code == 200
    assert r.content == b"1 2\n"
    assert "attachment" in r.headers["content-disposition"]


@pytest.mark.asyncio
async def test_download_non_sample_anonymous_forbidden(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="dl-hidden")
    await _make_test_case(db_session, p.id, ordinal=1, is_sample=False)

    r = await client.get(f"/api/problems/{p.slug}/input/1")
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_download_non_sample_author_allowed(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "dl-author", UserRole.teacher)
    p = await _make_problem(db_session, teacher.id, slug="dl-auth-prob")
    await _make_test_case(db_session, p.id, ordinal=1, is_sample=False, input_bytes=b"secret\n")
    await _login(client, "dl-author")

    r = await client.get(f"/api/problems/{p.slug}/input/1")
    assert r.status_code == 200
    assert r.content == b"secret\n"


@pytest.mark.asyncio
async def test_download_non_sample_admin_allowed(client: AsyncClient, db_session: AsyncSession) -> None:
    teacher = await _make_user(db_session, "dl-owner2", UserRole.teacher)
    await _make_user(db_session, "dl-admin", UserRole.admin)
    p = await _make_problem(db_session, teacher.id, slug="dl-admin-prob")
    await _make_test_case(db_session, p.id, ordinal=1, is_sample=False, input_bytes=b"42\n")
    await _login(client, "dl-admin")

    r = await client.get(f"/api/problems/{p.slug}/input/1")
    assert r.status_code == 200
    assert r.content == b"42\n"


@pytest.mark.asyncio
async def test_download_problem_not_found(client: AsyncClient) -> None:
    r = await client.get("/api/problems/nonexistent/input/1")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_download_test_case_not_found(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="dl-no-tc")
    r = await client.get(f"/api/problems/{p.slug}/input/99")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_download_private_problem_anonymous(client: AsyncClient, db_session: AsyncSession) -> None:
    p = await _make_problem(db_session, None, slug="dl-private", visibility=Visibility.private)
    await _make_test_case(db_session, p.id, ordinal=1, is_sample=True)

    r = await client.get(f"/api/problems/{p.slug}/input/1")
    assert r.status_code == 403
