"""Tests for the language catalogue (S2): config consistency, the /api/languages
endpoint, per-language judging wiring, and the execute() time-limit multiplier/pin."""

import uuid
from unittest.mock import AsyncMock, patch

import httpx
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app import piston as piston_client
from app.languages import LANGUAGES, LANGUAGES_BY_SLUG, STABLE_LANGUAGES
from app.models.problem import ComparisonMode, Problem, TestCase, Visibility
from app.models.user import User, UserRole
from app.piston import SUPPORTED_LANGUAGES, ExecutionResult
from app.security import hash_password
from app.storage import save_test_case
from app.worker import process_one_job

_PASSWORD = "testpassword1"


def test_supported_languages_matches_stable_slugs() -> None:
    assert {lang.slug for lang in STABLE_LANGUAGES} == SUPPORTED_LANGUAGES


@pytest.mark.parametrize("lang", LANGUAGES, ids=lambda lang: lang.slug)
def test_language_config_fields_are_populated(lang) -> None:
    assert lang.slug
    assert lang.display_name
    assert lang.piston_language
    assert lang.monaco_id
    assert lang.file_name
    assert lang.starter_template.strip()
    assert lang.time_limit_multiplier > 0
    if not lang.stable:
        assert lang.blocked_reason


def test_zig_and_pypy_are_marked_unstable() -> None:
    assert LANGUAGES_BY_SLUG["zig"].stable is False
    assert LANGUAGES_BY_SLUG["pypy"].stable is False
    assert "zig" not in SUPPORTED_LANGUAGES
    assert "pypy" not in SUPPORTED_LANGUAGES


def test_typescript_is_stable() -> None:
    assert LANGUAGES_BY_SLUG["typescript"].stable is True
    assert "typescript" in SUPPORTED_LANGUAGES


@pytest.mark.asyncio
async def test_get_languages_endpoint(client: AsyncClient) -> None:
    r = await client.get("/api/languages")
    assert r.status_code == 200
    body = r.json()
    assert len(body) == len(LANGUAGES)

    by_slug = {item["slug"]: item for item in body}
    assert by_slug["typescript"]["stable"] is True
    assert by_slug["zig"]["stable"] is False
    assert by_slug["zig"]["blocked_reason"]
    assert by_slug["pypy"]["stable"] is False
    assert by_slug["pypy"]["blocked_reason"]


def _mock_post_response(payload_capture: list) -> AsyncMock:
    async def fake_post(self, url, json=None, **kwargs):
        payload_capture.append(json)
        return httpx.Response(
            status_code=200,
            json={
                "run": {
                    "stdout": "42\n",
                    "stderr": "",
                    "code": 0,
                    "time": 0.05,
                    "memory": 1024 * 1024,
                },
                "language": json["language"],
                "version": json["version"],
            },
            request=httpx.Request("POST", url),
        )

    return fake_post


@pytest.mark.asyncio
async def test_execute_pins_version_and_applies_multiplier() -> None:
    captured: list = []
    with patch("httpx.AsyncClient.post", new=_mock_post_response(captured)):
        await piston_client.execute(
            language="python", code="print(1)", stdin="", time_limit_ms=1000, memory_limit_kb=65536
        )

    assert captured[0]["version"] == "3.12.0"
    assert captured[0]["run_timeout"] == 3000  # python multiplier is 3.0x


@pytest.mark.asyncio
async def test_execute_no_multiplier_for_compiled_language() -> None:
    captured: list = []
    with patch("httpx.AsyncClient.post", new=_mock_post_response(captured)):
        await piston_client.execute(
            language="cpp", code="int main(){}", stdin="", time_limit_ms=1000, memory_limit_kb=65536
        )

    assert captured[0]["version"] == "10.2.0"
    assert captured[0]["run_timeout"] == 1000


@pytest.mark.asyncio
async def test_execute_clamps_run_timeout_to_max() -> None:
    captured: list = []
    with patch("httpx.AsyncClient.post", new=_mock_post_response(captured)):
        await piston_client.execute(
            language="python",
            code="print(1)",
            stdin="",
            time_limit_ms=10_000,
            memory_limit_kb=65536,
        )

    # 10_000 * 3.0 = 30_000, clamped down to the 15_000 ceiling
    assert captured[0]["run_timeout"] == 15_000


async def _make_user(db: AsyncSession, username: str) -> User:
    user = User(
        username=username,
        email=f"{username}@example.com",
        password_hash=hash_password(_PASSWORD),
        display_name=username,
        role=UserRole.student,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def _login(client: AsyncClient, username: str) -> None:
    r = await client.post("/api/auth/login", json={"username": username, "password": _PASSWORD})
    assert r.status_code == 200, r.text


async def _make_problem(db: AsyncSession, author_id: uuid.UUID, slug: str) -> Problem:
    from datetime import UTC, datetime

    p = Problem(
        slug=slug,
        title="Read Print",
        statement_md="Read an int, print it plus one.",
        input_format="One int.",
        output_format="One int.",
        difficulty=1,
        author_id=author_id,
        visibility=Visibility.public,
        updated_at=datetime.now(UTC),
        comparison_mode=ComparisonMode.exact,
    )
    db.add(p)
    await db.commit()
    await db.refresh(p)
    return p


async def _make_test_case(db: AsyncSession, problem_id: uuid.UUID) -> TestCase:
    in_path, out_path = await save_test_case(problem_id, 1, b"41\n", b"42\n")
    tc = TestCase(
        problem_id=problem_id,
        ordinal=1,
        input_path=in_path,
        output_path=out_path,
        score=10,
        is_sample=True,
        is_hidden=False,
    )
    db.add(tc)
    await db.commit()
    await db.refresh(tc)
    return tc


@pytest.mark.asyncio
@pytest.mark.parametrize("lang", [lang.slug for lang in STABLE_LANGUAGES])
async def test_read_int_print_int_judges_ac_per_language(
    lang: str, client: AsyncClient, db_session: AsyncSession
) -> None:
    """Every stable language slug clears validation and judges to AC end-to-end.

    Piston itself is mocked (as in the rest of the suite) - this is about
    proving the slug is wired through submit -> validation -> judging, not
    re-verifying the sandbox, which was checked manually against the real
    container while building this language list.
    """
    user = await _make_user(db_session, f"lang-{lang}")
    problem = await _make_problem(db_session, user.id, slug=f"read-print-{lang}")
    await _make_test_case(db_session, problem.id)
    await _login(client, f"lang-{lang}")

    result = ExecutionResult(
        stdout="42\n",
        stderr="",
        exit_code=0,
        compile_error=False,
        time_ms=50,
        memory_kb=1024,
        timed_out=False,
    )

    r = await client.post(
        f"/api/problems/{problem.slug}/submit",
        data={"source_code": "irrelevant, piston is mocked", "language": lang},
    )
    assert r.status_code == 201, r.text

    with patch("app.judging.piston_client.execute", new_callable=AsyncMock, return_value=result):
        await process_one_job(db_session)

    r2 = await client.get(f"/api/submissions/{r.json()['id']}")
    assert r2.json()["verdict"] == "AC"
