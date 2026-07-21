"""User profile management: profile update, avatar upload, stats, external results."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy import case, func, or_, select
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
    DuelLeaderboardEntry,
    ExternalResultCreate,
    ExternalResultRead,
    ProblemsLeaderboardEntry,
    UserProfileUpdate,
    UserPublic,
    UserRead,
    UserStatsRead,
)
from app.storage import save_avatar

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/search", response_model=list[UserPublic])
async def search_users(
    q: str = Query(min_length=1, max_length=64),
    limit: int = Query(10, ge=1, le=20),
    session: AsyncSession = Depends(get_session),
) -> list[UserPublic]:
    """Caută utilizatori după username sau display name."""
    pattern = f"%{q}%"
    rows = await session.execute(
        select(User)
        .where(
            or_(
                User.username.ilike(pattern),
                User.display_name.ilike(pattern),
            )
        )
        .order_by(User.username)
        .limit(limit)
    )
    return [UserPublic.model_validate(u) for u in rows.scalars()]


_ACHIEVEMENTS: list[AchievementInfo] = [
    AchievementInfo(
        key="first_submission",
        label="Primul pas",
        description="Ai trimis prima submisie pe platformă",
    ),
    AchievementInfo(
        key="first_ac",
        label="Deblocat",
        description="Ai rezolvat prima problemă",
    ),
    AchievementInfo(
        key="first_duel",
        label="Intrat în arenă",
        description="Ai participat la primul duel",
    ),
    AchievementInfo(
        key="first_external",
        label="Dincolo de platformă",
        description="Ai adăugat un rezultat dintr-o competiție externă",
    ),
    AchievementInfo(
        key="10_ac",
        label="Constant",
        description="Ai rezolvat 10 probleme distincte",
    ),
    AchievementInfo(
        key="first_hard",
        label="Apetit pentru dificultate",
        description="Ai rezolvat o problemă cu dificultate ridicată (7+)",
    ),
    AchievementInfo(
        key="first_duel_win",
        label="Prima sânge",
        description="Ai câștigat primul duel",
    ),
    AchievementInfo(
        key="rating_1000",
        label="Calificat",
        description="Rating duel ≥ 1000",
    ),
    AchievementInfo(
        key="25_ac",
        label="Rezolvitor",
        description="Ai rezolvat 25 de probleme distincte",
    ),
    AchievementInfo(
        key="50_ac",
        label="Dedicat",
        description="Ai rezolvat 50 de probleme distincte",
    ),
    AchievementInfo(
        key="10_duel_wins",
        label="Duelant",
        description="Ai câștigat 10 dueluri",
    ),
    AchievementInfo(
        key="rating_1200",
        label="Expert",
        description="Rating duel ≥ 1200",
    ),
    AchievementInfo(
        key="verified_external",
        label="Legitimat",
        description="Un rezultat extern a fost verificat de admin",
    ),
    AchievementInfo(
        key="10_hard",
        label="Distrugător",
        description="Ai rezolvat 10 probleme cu dificultate ridicată (7+)",
    ),
    AchievementInfo(
        key="100_ac",
        label="Centurion",
        description="Ai rezolvat 100 de probleme distincte",
    ),
    AchievementInfo(
        key="50_duel_wins",
        label="Gladiator",
        description="Ai câștigat 50 de dueluri",
    ),
    AchievementInfo(
        key="rating_1500",
        label="Master",
        description="Rating duel ≥ 1500",
    ),
    AchievementInfo(
        key="250_ac",
        label="Maratonist",
        description="Ai rezolvat 250 de probleme distincte",
    ),
    AchievementInfo(
        key="rating_1800",
        label="Grandmaster",
        description="Rating duel ≥ 1800",
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
    if "github_url" in data.model_fields_set:
        user.github_url = data.github_url or None
    if "link_1" in data.model_fields_set:
        user.link_1 = data.link_1 or None
    if "link_2" in data.model_fields_set:
        user.link_2 = data.link_2 or None
    if "link_3" in data.model_fields_set:
        user.link_3 = data.link_3 or None

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
            achievements=_compute_achievements(target, 0, 0, 0, 0, 0, 0, False),
            problem_score=0,
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
    problem_score = dist["easy"] * 1 + dist["medium"] * 2 + dist["hard"] * 3

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
        target,
        total_submissions,
        total_solved,
        dist["hard"],
        ext_count,
        ext_verified,
        True,
    )

    return UserStatsRead(
        total_solved=total_solved,
        total_submissions=total_submissions,
        difficulty_distribution=DifficultyDistribution(**dist),
        achievements=earned_keys,
        problem_score=problem_score,
    )


def _compute_achievements(
    user: User,
    total_submissions: int,
    total_solved: int,
    hard_solved: int,
    ext_count: int,
    ext_verified: int,
    privacy_ok: bool,
) -> list[str]:
    earned: list[str] = []
    total_duels = user.duel_wins + user.duel_losses + user.duel_draws

    if total_submissions > 0:
        earned.append("first_submission")
    if privacy_ok and total_solved >= 1:
        earned.append("first_ac")
    if privacy_ok and hard_solved >= 1:
        earned.append("first_hard")
    if total_duels > 0:
        earned.append("first_duel")
    if ext_count > 0:
        earned.append("first_external")
    if privacy_ok and total_solved >= 10:
        earned.append("10_ac")
    if privacy_ok and hard_solved >= 10:
        earned.append("10_hard")
    if user.duel_wins >= 1:
        earned.append("first_duel_win")
    if user.duel_rating >= 1000:
        earned.append("rating_1000")
    if privacy_ok and total_solved >= 25:
        earned.append("25_ac")
    if privacy_ok and total_solved >= 50:
        earned.append("50_ac")
    if user.duel_wins >= 10:
        earned.append("10_duel_wins")
    if user.duel_rating >= 1200:
        earned.append("rating_1200")
    if ext_verified > 0:
        earned.append("verified_external")
    if privacy_ok and total_solved >= 100:
        earned.append("100_ac")
    if user.duel_wins >= 50:
        earned.append("50_duel_wins")
    if user.duel_rating >= 1500:
        earned.append("rating_1500")
    if privacy_ok and total_solved >= 250:
        earned.append("250_ac")
    if user.duel_rating >= 1800:
        earned.append("rating_1800")

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
    admin: User = require_role(UserRole.admin, UserRole.superuser),
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


async def _problems_leaderboard_query(
    session: AsyncSession,
    limit: int,
    since: datetime | None = None,
) -> list[ProblemsLeaderboardEntry]:
    """Shared logic for all-time and weekly problems leaderboards."""
    diff_label = case(
        (Problem.difficulty <= 3, "easy"),
        (Problem.difficulty <= 6, "medium"),
        else_="hard",
    )

    base_filter = Submission.verdict == Verdict.AC
    if since is not None:
        base_filter = base_filter & (Submission.created_at >= since)

    distinct_subq = (
        select(
            Submission.user_id.label("uid"),
            Submission.problem_id.label("pid"),
            diff_label.label("dgroup"),
        )
        .join(Problem, Submission.problem_id == Problem.id)
        .where(base_filter)
        .distinct()
        .subquery("ds")
    )

    easy_cnt = func.sum(case((distinct_subq.c.dgroup == "easy", 1), else_=0))
    medium_cnt = func.sum(case((distinct_subq.c.dgroup == "medium", 1), else_=0))
    hard_cnt = func.sum(case((distinct_subq.c.dgroup == "hard", 1), else_=0))
    score_expr = easy_cnt * 1 + medium_cnt * 2 + hard_cnt * 3

    rows = await session.execute(
        select(
            User.username,
            User.display_name,
            User.avatar_url,
            easy_cnt.label("solved_easy"),
            medium_cnt.label("solved_medium"),
            hard_cnt.label("solved_hard"),
            score_expr.label("problem_score"),
        )
        .join(distinct_subq, distinct_subq.c.uid == User.id)
        .where(User.privacy_show_solved.is_(True))
        .group_by(User.id, User.username, User.display_name, User.avatar_url)
        .order_by(score_expr.desc())
        .limit(limit)
    )

    result = []
    for rank, row in enumerate(rows, 1):
        solved_easy = row.solved_easy or 0
        solved_medium = row.solved_medium or 0
        solved_hard = row.solved_hard or 0
        result.append(
            ProblemsLeaderboardEntry(
                rank=rank,
                username=row.username,
                display_name=row.display_name,
                avatar_url=row.avatar_url,
                problem_score=row.problem_score or 0,
                total_solved=solved_easy + solved_medium + solved_hard,
                solved_easy=solved_easy,
                solved_medium=solved_medium,
                solved_hard=solved_hard,
            )
        )
    return result


@router.get("/leaderboard/problems", response_model=list[ProblemsLeaderboardEntry])
async def problems_leaderboard(
    limit: int = Query(100, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[ProblemsLeaderboardEntry]:
    """Clasament global (all-time) după scorul ponderat al problemelor rezolvate."""
    return await _problems_leaderboard_query(session, limit)


@router.get("/leaderboard/problems/weekly", response_model=list[ProblemsLeaderboardEntry])
async def problems_leaderboard_weekly(
    limit: int = Query(100, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[ProblemsLeaderboardEntry]:
    """Clasament săptămânal după scorul ponderat al problemelor rezolvate în ultimele 7 zile."""
    since = datetime.now(UTC) - timedelta(days=7)
    return await _problems_leaderboard_query(session, limit, since=since)


@router.get("/leaderboard/duels", response_model=list[DuelLeaderboardEntry])
async def duels_leaderboard(
    limit: int = Query(100, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
) -> list[DuelLeaderboardEntry]:
    """Clasament global după rating-ul de duel (all-time)."""
    total_duels = User.duel_wins + User.duel_losses + User.duel_draws

    rows = await session.execute(
        select(User).where(total_duels > 0).order_by(User.duel_rating.desc()).limit(limit)
    )

    return [
        DuelLeaderboardEntry(
            rank=rank,
            username=u.username,
            display_name=u.display_name,
            avatar_url=u.avatar_url,
            duel_rating=u.duel_rating,
            duel_wins=u.duel_wins,
            duel_losses=u.duel_losses,
            duel_draws=u.duel_draws,
        )
        for rank, u in enumerate(rows.scalars(), 1)
    ]
