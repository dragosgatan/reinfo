"""Optional read-only GitHub repo metadata for teacher project submissions.

Gated behind ENABLE_GITHUB_INTEGRATION (default off). Never authenticated (no
tokens stored - unauthenticated GitHub REST API only), always cached in
github_repo_cache, and always falls back to just the link on any failure -
this must never block or affect a student's submission.
"""

import logging
import re
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.project import GithubRepoCache

log = logging.getLogger(__name__)

_REPO_URL_RE = re.compile(r"^https://github\.com/(?P<owner>[\w.-]+)/(?P<repo>[\w.-]+?)/?$")
_LAST_PAGE_RE = re.compile(r'page=(\d+)>;\s*rel="last"')
_CACHE_TTL = timedelta(hours=6)
_GITHUB_API = "https://api.github.com"
_README_MAX_CHARS = 20_000


def parse_repo_url(url: str) -> tuple[str, str] | None:
    """Extract (owner, repo) from a github.com URL, or None if it doesn't match."""
    match = _REPO_URL_RE.match(url.strip())
    if match is None:
        return None
    return match.group("owner"), match.group("repo").removesuffix(".git")


async def get_repo_info(session: AsyncSession, repo_url: str) -> GithubRepoCache | None:
    """Return cached (or freshly fetched) repo metadata, or None if the feature is disabled."""
    if not settings.enable_github_integration:
        return None
    if parse_repo_url(repo_url) is None:
        return None

    cached = await session.scalar(
        select(GithubRepoCache).where(GithubRepoCache.repo_url == repo_url)
    )
    now = datetime.now(UTC)
    if cached is not None and (now - cached.fetched_at) < _CACHE_TTL:
        return cached

    owner, repo = parse_repo_url(repo_url)  # type: ignore[misc]
    fetched = await _fetch_repo_metadata(owner, repo)

    if cached is not None:
        for field, value in fetched.items():
            setattr(cached, field, value)
        cached.fetched_at = now
    else:
        cached = GithubRepoCache(repo_url=repo_url, fetched_at=now, **fetched)
        session.add(cached)
    await session.commit()
    await session.refresh(cached)
    return cached


async def _fetch_repo_metadata(owner: str, repo: str) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(
            timeout=8.0, headers={"Accept": "application/vnd.github+json"}
        ) as client:
            repo_resp = await client.get(f"{_GITHUB_API}/repos/{owner}/{repo}")
            if repo_resp.status_code == 404:
                return {"ok": False, "error_reason": "not_found"}
            if repo_resp.status_code == 403:
                return {"ok": False, "error_reason": "rate_limited"}
            repo_resp.raise_for_status()
            repo_data = repo_resp.json()

            last_commit_at = None
            commit_count = None
            commits_resp = await client.get(
                f"{_GITHUB_API}/repos/{owner}/{repo}/commits", params={"per_page": 1}
            )
            if commits_resp.status_code == 200:
                commits = commits_resp.json()
                if commits:
                    last_commit_at = datetime.fromisoformat(
                        commits[0]["commit"]["committer"]["date"].replace("Z", "+00:00")
                    )
                link_match = _LAST_PAGE_RE.search(commits_resp.headers.get("Link", ""))
                commit_count = int(link_match.group(1)) if link_match else len(commits)

            readme_md = None
            readme_resp = await client.get(
                f"{_GITHUB_API}/repos/{owner}/{repo}/readme",
                headers={"Accept": "application/vnd.github.raw+json"},
            )
            if readme_resp.status_code == 200:
                readme_md = readme_resp.text[:_README_MAX_CHARS]

            return {
                "ok": True,
                "error_reason": None,
                "language": repo_data.get("language"),
                "stars": repo_data.get("stargazers_count"),
                "last_commit_at": last_commit_at,
                "commit_count_approx": commit_count,
                "readme_md": readme_md,
            }
    except httpx.HTTPError:
        log.warning("GitHub metadata fetch failed for %s/%s", owner, repo, exc_info=True)
        return {"ok": False, "error_reason": "network_error"}
