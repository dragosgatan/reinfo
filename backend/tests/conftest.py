import os
from collections.abc import AsyncGenerator
from pathlib import Path
from unittest.mock import patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.models  # noqa: F401 – registers all ORM models
from app.db import get_session
from app.main import app
from app.models.base import Base

TEST_DB_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://reinfo:reinfo@localhost:5432/reinfo_test",
)

_engine = create_async_engine(TEST_DB_URL)
_session_factory = async_sessionmaker(_engine, expire_on_commit=False)


@pytest.fixture(scope="session", autouse=True)
async def create_schema() -> AsyncGenerator[None, None]:
    """Drop and recreate schema once for the entire test session."""
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


@pytest.fixture(scope="session", autouse=True)
async def override_get_session(create_schema: None) -> AsyncGenerator[None, None]:
    """Redirect the app's DB dependency to the test database."""

    async def _test_session() -> AsyncGenerator[AsyncSession, None]:
        async with _session_factory() as session:
            yield session

    app.dependency_overrides[get_session] = _test_session
    yield
    app.dependency_overrides.pop(get_session, None)


@pytest.fixture(autouse=True)
async def clean_tables() -> AsyncGenerator[None, None]:
    """Delete all rows between tests to keep state isolated."""
    yield
    async with _engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            await conn.execute(table.delete())


@pytest.fixture(autouse=True)
def bypass_rate_limiting() -> None:
    """Disable rate limiting for all tests.

    Patching limiter.enabled=False skips both _check_request_limit and the
    view_rate_limit header injection that would otherwise crash when the check
    is mocked away.
    """
    from unittest.mock import patch

    from app.limiter import limiter

    with patch.object(limiter, "enabled", False):
        yield


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with _session_factory() as session:
        yield session


@pytest.fixture(autouse=True)
def tmp_storage(tmp_path: Path) -> AsyncGenerator[None, None]:
    """Redirect file storage to a per-test temporary directory."""
    from app.config import settings

    with patch.object(settings, "data_dir", str(tmp_path)):
        yield
