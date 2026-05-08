"""Background worker that polls for queued judging jobs and processes them.

Run with: python -m app.worker
Multiple instances are safe — FOR UPDATE SKIP LOCKED prevents double-processing.
"""

import asyncio
import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.judging import judge_submission
from app.models.judging_job import JobStatus, JudgingJob

log = logging.getLogger(__name__)

_POLL_INTERVAL = 0.5


async def process_one_job(session: AsyncSession) -> bool:
    """Claim and process one queued job.

    Uses FOR UPDATE SKIP LOCKED so concurrent workers never double-process the
    same submission. Returns True if a job was claimed and processed.
    """
    job = await session.scalar(
        select(JudgingJob)
        .where(JudgingJob.status == JobStatus.queued)
        .order_by(JudgingJob.created_at)
        .limit(1)
        .with_for_update(skip_locked=True)
    )
    if job is None:
        await session.rollback()
        return False

    job_id = job.id
    submission_id = job.submission_id
    job.status = JobStatus.running
    job.started_at = datetime.now(UTC)
    job.attempts += 1
    await session.commit()

    error: str | None = None
    try:
        await judge_submission(submission_id, session)
    except Exception as exc:
        log.exception("judging failed for submission %s", submission_id)
        error = str(exc)[:1000]
        await session.rollback()

    job = await session.get(JudgingJob, job_id)
    if job is not None:
        job.status = JobStatus.failed if error else JobStatus.done
        job.finished_at = datetime.now(UTC)
        if error:
            job.last_error = error
        await session.commit()

    return True


async def run_worker() -> None:
    """Poll for queued jobs forever, processing one per iteration."""
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    log.info("worker started, polling every %.1fs", _POLL_INTERVAL)
    while True:
        try:
            async with factory() as session:
                await process_one_job(session)
        except Exception:
            log.exception("unhandled error in worker loop")
        await asyncio.sleep(_POLL_INTERVAL)


if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(run_worker())
