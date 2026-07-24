"""Track endpoints: multi-olympiad preparation checklists."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.models.ctf import CtfChallenge
from app.models.lesson import Lesson
from app.models.problem import Problem
from app.models.track import (
    Track,
    TrackAudience,
    TrackItem,
    TrackItemStatus,
    TrackItemType,
    TrackProgress,
)
from app.models.user import User, UserRole
from app.schemas.track import (
    TrackCreate,
    TrackDetail,
    TrackItemCreate,
    TrackItemProgressUpdate,
    TrackItemRead,
    TrackItemUpdate,
    TrackListResponse,
    TrackSummary,
    TrackUpdate,
)

router = APIRouter(prefix="/api/tracks", tags=["tracks"])

_UNAVAILABLE_TITLE = "(conținut indisponibil)"


def _can_author(user: User) -> bool:
    return user.role in (UserRole.teacher, UserRole.admin, UserRole.superuser)


def _can_edit(track: Track, user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.superuser) or track.created_by == user.id


async def _get_track_or_404(slug: str, session: AsyncSession, *, load_items: bool = False) -> Track:
    stmt = select(Track).where(Track.slug == slug)
    if load_items:
        stmt = stmt.options(selectinload(Track.items))
    track = await session.scalar(stmt)
    if track is None:
        raise HTTPException(status_code=404, detail="Traseul nu a fost găsit")
    return track


async def _ref_exists(session: AsyncSession, item_type: TrackItemType, ref_id: uuid.UUID) -> bool:
    model = {
        TrackItemType.lesson: Lesson,
        TrackItemType.problem: Problem,
        TrackItemType.ctf_challenge: CtfChallenge,
    }[item_type]
    return (await session.scalar(select(model.id).where(model.id == ref_id))) is not None


async def _resolve_ref_info(
    session: AsyncSession, items: list[TrackItem]
) -> dict[uuid.UUID, tuple[str, str]]:
    """Batch-resolve (title, slug) for each item's referenced content, one query per type."""
    result: dict[uuid.UUID, tuple[str, str]] = {}
    by_type: dict[TrackItemType, list[uuid.UUID]] = {}
    for item in items:
        by_type.setdefault(item.item_type, []).append(item.ref_id)

    models = {
        TrackItemType.lesson: Lesson,
        TrackItemType.problem: Problem,
        TrackItemType.ctf_challenge: CtfChallenge,
    }
    for item_type, ref_ids in by_type.items():
        model = models[item_type]
        rows = (
            await session.execute(
                select(model.id, model.title, model.slug).where(model.id.in_(ref_ids))
            )
        ).all()
        for ref_id, title, slug in rows:
            result[ref_id] = (title, slug)

    return result


async def _has_cycle(
    session: AsyncSession, track_id: uuid.UUID, item_id: uuid.UUID, new_prereq_id: uuid.UUID
) -> bool:
    """Walk the prerequisite chain up from new_prereq_id; True if it reaches item_id."""
    current: uuid.UUID | None = new_prereq_id
    seen: set[uuid.UUID] = set()
    while current is not None:
        if current == item_id:
            return True
        if current in seen:
            return True
        seen.add(current)
        current = await session.scalar(
            select(TrackItem.prerequisite_item_id).where(
                TrackItem.id == current, TrackItem.track_id == track_id
            )
        )
    return False


def _unlock_status(
    item: TrackItem, status_by_item: dict[uuid.UUID, TrackItemStatus]
) -> tuple[TrackItemStatus, str]:
    status = status_by_item.get(item.id, TrackItemStatus.not_started)
    if status == TrackItemStatus.done:
        return status, "done"
    if item.prerequisite_item_id is None:
        return status, "available"
    prereq_status = status_by_item.get(item.prerequisite_item_id, TrackItemStatus.not_started)
    return status, "available" if prereq_status == TrackItemStatus.done else "locked"


@router.get("", response_model=TrackListResponse)
async def list_tracks(
    audience: TrackAudience | None = Query(default=None),
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> TrackListResponse:
    """Lista traseelor de pregătire, cu procentul de completare al utilizatorului curent."""
    stmt = select(Track).options(selectinload(Track.items))
    if current_user is None or not _can_author(current_user):
        stmt = stmt.where(Track.published.is_(True))
    if audience is not None:
        stmt = stmt.where(Track.audience == audience)
    stmt = stmt.order_by(Track.olympiad.asc(), Track.order.asc(), Track.created_at.asc())

    tracks = (await session.scalars(stmt)).all()

    status_by_item: dict[uuid.UUID, TrackItemStatus] = {}
    if current_user is not None:
        all_item_ids = [i.id for t in tracks for i in t.items]
        if all_item_ids:
            rows = (
                await session.scalars(
                    select(TrackProgress).where(
                        TrackProgress.user_id == current_user.id,
                        TrackProgress.item_id.in_(all_item_ids),
                    )
                )
            ).all()
            status_by_item = {p.item_id: p.status for p in rows}

    items: list[TrackSummary] = []
    for track in tracks:
        total = len(track.items)
        completed = sum(1 for i in track.items if status_by_item.get(i.id) == TrackItemStatus.done)
        pct = round(completed / total * 100, 1) if total > 0 else 0.0
        items.append(
            TrackSummary(
                id=track.id,
                slug=track.slug,
                title=track.title,
                olympiad=track.olympiad,
                audience=track.audience,
                order=track.order,
                published=track.published,
                item_count=total,
                completed_items=completed,
                completion_pct=pct,
            )
        )

    return TrackListResponse(items=items, total=len(items))


@router.get("/{slug}", response_model=TrackDetail)
async def get_track(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> TrackDetail:
    """Structura completă a traseului, cu progresul utilizatorului curent și starea de blocare."""
    track = await _get_track_or_404(slug, session, load_items=True)

    if not track.published and (current_user is None or not _can_author(current_user)):
        raise HTTPException(status_code=404, detail="Traseul nu a fost găsit")

    sorted_items = sorted(track.items, key=lambda i: (i.order, str(i.id)))

    status_by_item: dict[uuid.UUID, TrackItemStatus] = {}
    if current_user is not None and sorted_items:
        rows = (
            await session.scalars(
                select(TrackProgress).where(
                    TrackProgress.user_id == current_user.id,
                    TrackProgress.item_id.in_([i.id for i in sorted_items]),
                )
            )
        ).all()
        status_by_item = {p.item_id: p.status for p in rows}

    ref_info = await _resolve_ref_info(session, sorted_items)

    items_read: list[TrackItemRead] = []
    for item in sorted_items:
        title, ref_slug = ref_info.get(item.ref_id, (_UNAVAILABLE_TITLE, ""))
        status, unlock = _unlock_status(item, status_by_item)
        items_read.append(
            TrackItemRead(
                id=item.id,
                item_type=item.item_type,
                ref_id=item.ref_id,
                ref_title=title,
                ref_slug=ref_slug,
                order=item.order,
                prerequisite_item_id=item.prerequisite_item_id,
                status=status,
                unlock_status=unlock,  # type: ignore[arg-type]
            )
        )

    total = len(sorted_items)
    completed = sum(1 for i in items_read if i.status == TrackItemStatus.done)
    pct = round(completed / total * 100, 1) if total > 0 else 0.0

    return TrackDetail(
        id=track.id,
        slug=track.slug,
        title=track.title,
        olympiad=track.olympiad,
        audience=track.audience,
        order=track.order,
        published=track.published,
        item_count=total,
        completed_items=completed,
        completion_pct=pct,
        description_md=track.description_md,
        items=items_read,
    )


@router.post("", response_model=TrackDetail, status_code=201)
async def create_track(
    data: TrackCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TrackDetail:
    """Creează un traseu nou. Necesită rolul de profesor sau administrator."""
    if not _can_author(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    existing = await session.scalar(select(Track).where(Track.slug == data.slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Există deja un traseu cu acest slug")

    track = Track(**data.model_dump(), created_by=current_user.id)
    session.add(track)
    await session.commit()
    await session.refresh(track)

    return TrackDetail(
        id=track.id,
        slug=track.slug,
        title=track.title,
        olympiad=track.olympiad,
        audience=track.audience,
        order=track.order,
        published=track.published,
        item_count=0,
        completed_items=0,
        completion_pct=0.0,
        description_md=track.description_md,
        items=[],
    )


@router.patch("/{slug}", response_model=TrackDetail)
async def update_track(
    slug: str,
    data: TrackUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TrackDetail:
    """Editează metadatele traseului. Autorul, profesorul sau administratorul."""
    track = await _get_track_or_404(slug, session, load_items=True)
    if not _can_edit(track, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(track, field, value)
    await session.commit()
    await session.refresh(track)

    return await get_track(slug, session, current_user)


@router.delete("/{slug}", status_code=200)
async def delete_track(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Șterge permanent un traseu. Autorul, profesorul sau administratorul."""
    track = await _get_track_or_404(slug, session)
    if not _can_edit(track, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    await session.delete(track)
    await session.commit()
    return {"message": "Traseul a fost șters"}


@router.post("/{slug}/items", response_model=TrackItemRead, status_code=201)
async def create_item(
    slug: str,
    data: TrackItemCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TrackItemRead:
    """Adaugă un element (lecție/problemă/provocare CTF) în traseu."""
    track = await _get_track_or_404(slug, session)
    if not _can_edit(track, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    if not await _ref_exists(session, data.item_type, data.ref_id):
        raise HTTPException(status_code=400, detail="Conținutul referit nu există")

    if data.prerequisite_item_id is not None:
        prereq = await session.scalar(
            select(TrackItem).where(
                TrackItem.id == data.prerequisite_item_id, TrackItem.track_id == track.id
            )
        )
        if prereq is None:
            raise HTTPException(
                status_code=400, detail="Elementul prerechizit nu aparține acestui traseu"
            )

    item = TrackItem(track_id=track.id, **data.model_dump())
    session.add(item)
    await session.commit()
    await session.refresh(item)

    ref_info = await _resolve_ref_info(session, [item])
    title, ref_slug = ref_info.get(item.ref_id, (_UNAVAILABLE_TITLE, ""))
    return TrackItemRead(
        id=item.id,
        item_type=item.item_type,
        ref_id=item.ref_id,
        ref_title=title,
        ref_slug=ref_slug,
        order=item.order,
        prerequisite_item_id=item.prerequisite_item_id,
        status=TrackItemStatus.not_started,
        unlock_status="available" if item.prerequisite_item_id is None else "locked",
    )


@router.patch("/{slug}/items/{item_id}", response_model=TrackItemRead)
async def update_item(
    slug: str,
    item_id: uuid.UUID,
    data: TrackItemUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TrackItemRead:
    """Editează ordinea sau prerechizitul unui element din traseu."""
    track = await _get_track_or_404(slug, session)
    if not _can_edit(track, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    item = await session.scalar(
        select(TrackItem).where(TrackItem.id == item_id, TrackItem.track_id == track.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Elementul nu a fost găsit")

    if data.order is not None:
        item.order = data.order

    if data.clear_prerequisite:
        item.prerequisite_item_id = None
    elif data.prerequisite_item_id is not None:
        if data.prerequisite_item_id == item.id:
            raise HTTPException(
                status_code=400, detail="Un element nu poate fi propriul prerechizit"
            )
        prereq = await session.scalar(
            select(TrackItem).where(
                TrackItem.id == data.prerequisite_item_id, TrackItem.track_id == track.id
            )
        )
        if prereq is None:
            raise HTTPException(
                status_code=400, detail="Elementul prerechizit nu aparține acestui traseu"
            )
        if await _has_cycle(session, track.id, item.id, data.prerequisite_item_id):
            raise HTTPException(status_code=400, detail="Prerechizitele nu pot forma un ciclu")
        item.prerequisite_item_id = data.prerequisite_item_id

    await session.commit()
    await session.refresh(item)

    ref_info = await _resolve_ref_info(session, [item])
    title, ref_slug = ref_info.get(item.ref_id, (_UNAVAILABLE_TITLE, ""))
    return TrackItemRead(
        id=item.id,
        item_type=item.item_type,
        ref_id=item.ref_id,
        ref_title=title,
        ref_slug=ref_slug,
        order=item.order,
        prerequisite_item_id=item.prerequisite_item_id,
        status=TrackItemStatus.not_started,
        unlock_status="available" if item.prerequisite_item_id is None else "locked",
    )


@router.delete("/{slug}/items/{item_id}", status_code=200)
async def delete_item(
    slug: str,
    item_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Elimină un element din traseu."""
    track = await _get_track_or_404(slug, session)
    if not _can_edit(track, current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    item = await session.scalar(
        select(TrackItem).where(TrackItem.id == item_id, TrackItem.track_id == track.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Elementul nu a fost găsit")

    await session.delete(item)
    await session.commit()
    return {"message": "Elementul a fost eliminat"}


@router.put("/{slug}/items/{item_id}/progress", response_model=TrackItemRead)
async def set_progress(
    slug: str,
    item_id: uuid.UUID,
    data: TrackItemProgressUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> TrackItemRead:
    """Setează statusul unui element pentru utilizatorul curent. Blocat de prerechizite."""
    track = await _get_track_or_404(slug, session)
    if not track.published and not _can_author(current_user):
        raise HTTPException(status_code=404, detail="Traseul nu a fost găsit")

    item = await session.scalar(
        select(TrackItem).where(TrackItem.id == item_id, TrackItem.track_id == track.id)
    )
    if item is None:
        raise HTTPException(status_code=404, detail="Elementul nu a fost găsit")

    if data.status != TrackItemStatus.not_started and item.prerequisite_item_id is not None:
        prereq_progress = await session.scalar(
            select(TrackProgress).where(
                TrackProgress.user_id == current_user.id,
                TrackProgress.item_id == item.prerequisite_item_id,
            )
        )
        if prereq_progress is None or prereq_progress.status != TrackItemStatus.done:
            raise HTTPException(
                status_code=400, detail="Finalizează mai întâi elementul anterior din traseu"
            )

    now = datetime.now(UTC)
    existing = await session.scalar(
        select(TrackProgress).where(
            TrackProgress.user_id == current_user.id, TrackProgress.item_id == item.id
        )
    )
    if existing is not None:
        existing.status = data.status
        existing.completed_at = now if data.status == TrackItemStatus.done else None
    else:
        existing = TrackProgress(
            user_id=current_user.id,
            item_id=item.id,
            status=data.status,
            completed_at=now if data.status == TrackItemStatus.done else None,
        )
        session.add(existing)
    await session.commit()

    ref_info = await _resolve_ref_info(session, [item])
    title, ref_slug = ref_info.get(item.ref_id, (_UNAVAILABLE_TITLE, ""))

    status_by_item = {item.id: data.status}
    if item.prerequisite_item_id is not None:
        prereq_status_row = await session.scalar(
            select(TrackProgress.status).where(
                TrackProgress.user_id == current_user.id,
                TrackProgress.item_id == item.prerequisite_item_id,
            )
        )
        if prereq_status_row is not None:
            status_by_item[item.prerequisite_item_id] = prereq_status_row
    _, unlock = _unlock_status(item, status_by_item)

    return TrackItemRead(
        id=item.id,
        item_type=item.item_type,
        ref_id=item.ref_id,
        ref_title=title,
        ref_slug=ref_slug,
        order=item.order,
        prerequisite_item_id=item.prerequisite_item_id,
        status=data.status,
        unlock_status=unlock,  # type: ignore[arg-type]
    )
