"""User profile management: profile update, avatar upload, stats, external results."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.dependencies import get_current_user, require_role
from app.models.problem import Problem
from app.models.submission import Submission, Verdict
from app.models.user import ExternalResult, User, UserRole
from app.schemas.user import (
    AchievementInfo,
    ActivityDay,
    DifficultyDistribution,
    ExternalResultCreate,
    ExternalResultRead,
    UserProfileUpdate,
    UserRead,
    UserStatsRead,
)
from app.storage import save_avatar

router = APIRouter(prefix="/api/users", tags=["users"])

_ACHIEVEMENTS: list[AchievementInfo] = [
    AchievementInfo(
        key="first_submission",
        label="Prima submisie",
        description="Ai trimis prima submisie",
    ),
    AchievementInfo(
        key="first_ac",
        label="Primul AC",
        description="Ai rezolvat prima problemă",
    ),
    AchievementInfo(
        key="10_ac",
        label="Consistent",
        description="Ai rezolvat 10 probleme distincte",
    ),
    AchievementInfo(
        key="50_ac",
        label="Experimentat",
        description="Ai rezolvat 50 de probleme distincte",
    ),
    AchievementInfo(
        key="100_ac",
        label="Maestru",
        description="Ai rezolvat 100 de probleme distincte",
    ),
    AchievementInfo(
        key="first_duel",
        label="Primul duel",
        description="Ai participat la un duel",
    ),
    AchievementInfo(
        key="first_duel_win",
        label="Prima victorie",
        description="Ai câștigat primul duel",
    ),
    AchievementInfo(
        key="10_duel_wins",
        label="Duelant",
        description="Ai câștigat 10 dueluri",
    ),
    AchievementInfo(
        key="rating_1000",
        label="Challenger",
        description="Duel rating ≥ 1000",
    ),
    AchievementInfo(
        key="rating_1200",
        label="Expert",
        description="Duel rating ≥ 1200",
    ),
    AchievementInfo(
        key="rating_1500",
        label="Master",
        description="Duel rating ≥ 1500",
    ),
    AchievementInfo(
        key="first_external",
        label="Competitor",
        description="Ai adăugat un rezultat extern",
    ),
    AchievementInfo(
        key="verified_external",
        label="Verificat",
        description="Un rezultat extern a fost verificat de admin",
    ),
]

_ACHIEVEMENT_MAP = {a.key: a for a in _ACHIEVEMENTS}


@router.patch("/me", response_model=UserRead)
async def update_profile(
    data: UserProfileUpdate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Actualizează profilul utilizatorului autentificat."""
    if data.display_name is not None:
        user.display_name = data.display_name
    if data.bio is not None:
        user.bio = data.bio or None
    if data.language is not None:
        user.language = data.language
    if data.privacy_show_email is not None:
        user.privacy_show_email = data.privacy_show_email
    if data.privacy_show_activity is not None:
        user.privacy_show_activity = data.privacy_show_activity
    if data.privacy_show_solved is not None:
        user.privacy_show_solved = data.privacy_show_solved

    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.post("/me/avatar", response_model=UserRead)
async def upload_avatar(
    file: UploadFile,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> UserRead:
    """Încarcă un avatar nou pentru utilizatorul autentificat (JPEG, PNG sau WebP, max 2 MB)."""
    content_type = file.content_type or ""
    data = await file.read()
    try:
        url_path = await save_avatar(user.id, content_type, data)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)
        ) from exc

    user.avatar_url = url_path
    await session.commit()
    await session.refresh(user)
    return UserRead.model_validate(user)


@router.get("/{username}/activity", response_model=list[ActivityDay])
async def get_activity(
    username: str,
    session: AsyncSession = Depends(get_session),
) -> list[ActivityDay]:
    """Heatmap de activitate: submisii per zi din ultimele 365 de zile."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    if not target.privacy_show_activity:
        return []

    since = datetime.now(UTC) - timedelta(days=365)
    rows = await session.execute(
        select(
            func.date(Submission.created_at).label("day"),
            func.count().label("cnt"),
        )
        .where(Submission.user_id == target.id, Submission.created_at >= since)
        .group_by(func.date(Submission.created_at))
        .order_by(func.date(Submission.created_at))
    )
    return [ActivityDay(date=str(row.day), count=row.cnt) for row in rows]


@router.get("/{username}/stats", response_model=UserStatsRead)
async def get_stats(
    username: str,
    session: AsyncSession = Depends(get_session),
) -> UserStatsRead:
    """Statistici profil: total rezolvate, submisii, distribuție dificultate, realizări."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    total_submissions = (
        await session.scalar(select(func.count()).where(Submission.user_id == target.id))
    ) or 0

    if not target.privacy_show_solved:
        return UserStatsRead(
            total_solved=0,
            total_submissions=total_submissions,
            difficulty_distribution=DifficultyDistribution(easy=0, medium=0, hard=0),
            achievements=_compute_achievements(target, 0, 0, 0, 0, False),
        )

    diff_rows = await session.execute(
        select(
            case(
                (Problem.difficulty <= 3, "easy"),
                (Problem.difficulty <= 6, "medium"),
                else_="hard",
            ).label("group"),
            func.count(Submission.problem_id.distinct()).label("cnt"),
        )
        .join(Problem, Submission.problem_id == Problem.id)
        .where(Submission.user_id == target.id, Submission.verdict == Verdict.AC)
        .group_by("group")
    )
    dist: dict[str, int] = {"easy": 0, "medium": 0, "hard": 0}
    for row in diff_rows:
        dist[row.group] = row.cnt

    total_solved = dist["easy"] + dist["medium"] + dist["hard"]

    ext_count = (
        await session.scalar(select(func.count()).where(ExternalResult.user_id == target.id))
    ) or 0
    ext_verified = (
        await session.scalar(
            select(func.count()).where(
                ExternalResult.user_id == target.id, ExternalResult.verified.is_(True)
            )
        )
    ) or 0

    earned_keys = _compute_achievements(
        target, total_submissions, total_solved, ext_count, ext_verified, True
    )

    return UserStatsRead(
        total_solved=total_solved,
        total_submissions=total_submissions,
        difficulty_distribution=DifficultyDistribution(**dist),
        achievements=earned_keys,
    )


def _compute_achievements(
    user: User,
    total_submissions: int,
    total_solved: int,
    ext_count: int,
    ext_verified: int,
    privacy_ok: bool,
) -> list[str]:
    earned: list[str] = []
    total_duels = user.duel_wins + user.duel_losses + user.duel_draws

    if total_submissions > 0:
        earned.append("first_submission")
    if privacy_ok and total_solved > 0:
        earned.append("first_ac")
    if privacy_ok and total_solved >= 10:
        earned.append("10_ac")
    if privacy_ok and total_solved >= 50:
        earned.append("50_ac")
    if privacy_ok and total_solved >= 100:
        earned.append("100_ac")
    if total_duels > 0:
        earned.append("first_duel")
    if user.duel_wins > 0:
        earned.append("first_duel_win")
    if user.duel_wins >= 10:
        earned.append("10_duel_wins")
    if user.duel_rating >= 1000:
        earned.append("rating_1000")
    if user.duel_rating >= 1200:
        earned.append("rating_1200")
    if user.duel_rating >= 1500:
        earned.append("rating_1500")
    if ext_count > 0:
        earned.append("first_external")
    if ext_verified > 0:
        earned.append("verified_external")

    return earned


@router.get("/{username}/external-results", response_model=list[ExternalResultRead])
async def list_external_results(
    username: str,
    session: AsyncSession = Depends(get_session),
) -> list[ExternalResultRead]:
    """Lista rezultatelor externe ale unui utilizator."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    rows = await session.execute(
        select(ExternalResult)
        .where(ExternalResult.user_id == target.id)
        .order_by(ExternalResult.year.desc(), ExternalResult.created_at.desc())
    )
    return [ExternalResultRead.model_validate(r) for r in rows.scalars()]


@router.post("/me/external-results", response_model=ExternalResultRead, status_code=201)
async def add_external_result(
    data: ExternalResultCreate,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> ExternalResultRead:
    """Adaugă un rezultat extern auto-declarat."""
    result = ExternalResult(
        user_id=user.id,
        contest_name=data.contest_name,
        platform=data.platform,
        result_text=data.result_text,
        year=data.year,
    )
    session.add(result)
    await session.commit()
    await session.refresh(result)
    return ExternalResultRead.model_validate(result)


@router.delete("/me/external-results/{result_id}", status_code=204)
async def delete_external_result(
    result_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """Șterge un rezultat extern propriu."""
    result = await session.scalar(
        select(ExternalResult).where(
            ExternalResult.id == result_id, ExternalResult.user_id == user.id
        )
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Rezultatul nu a fost găsit")
    await session.delete(result)
    await session.commit()


@router.patch(
    "/{username}/external-results/{result_id}/verify",
    response_model=ExternalResultRead,
)
async def verify_external_result(
    username: str,
    result_id: uuid.UUID,
    admin: User = require_role(UserRole.admin),
    session: AsyncSession = Depends(get_session),
) -> ExternalResultRead:
    """Verifică sau anulează verificarea unui rezultat extern (doar admin)."""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    result = await session.scalar(
        select(ExternalResult).where(
            ExternalResult.id == result_id, ExternalResult.user_id == target.id
        )
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Rezultatul nu a fost găsit")

    result.verified = not result.verified
    result.verified_by_id = admin.id if result.verified else None
    await session.commit()
    await session.refresh(result)
    return ExternalResultRead.model_validate(result)


@router.get("/achievements/list", response_model=list[AchievementInfo])
async def list_achievements() -> list[AchievementInfo]:
    """Returnează lista completă de realizări posibile."""
    return _ACHIEVEMENTS
