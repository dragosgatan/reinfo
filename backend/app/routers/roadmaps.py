"""Roadmap endpoints."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db import get_session
from app.dependencies import get_current_user, get_optional_user
from app.models.roadmap import (
    NodeStatus,
    Roadmap,
    RoadmapEdge,
    RoadmapNode,
    RoadmapNodeLink,
    UserRoadmapProgress,
)
from app.models.user import User, UserRole
from app.schemas.roadmap import (
    NodeLinkCreate,
    NodeLinkRead,
    ProgressRead,
    ProgressUpdate,
    RoadmapCreate,
    RoadmapDetail,
    RoadmapEdgeCreate,
    RoadmapEdgeRead,
    RoadmapListResponse,
    RoadmapNodeCreate,
    RoadmapNodeRead,
    RoadmapNodeUpdate,
    RoadmapSummary,
    RoadmapUpdate,
)

router = APIRouter(prefix="/api/roadmaps", tags=["roadmaps"])


def _is_admin(user: User) -> bool:
    return user.role in (UserRole.admin, UserRole.superuser)


async def _get_roadmap_or_404(
    slug: str,
    session: AsyncSession,
    *,
    load_relations: bool = False,
) -> Roadmap:
    """Load a roadmap by slug, optionally eager-loading nodes+links and edges."""
    stmt = select(Roadmap).where(Roadmap.slug == slug)
    if load_relations:
        stmt = stmt.options(
            selectinload(Roadmap.nodes).selectinload(RoadmapNode.links),
            selectinload(Roadmap.edges),
        )
    roadmap = await session.scalar(stmt)
    if roadmap is None:
        raise HTTPException(status_code=404, detail="Harta de parcurs nu a fost găsită")
    return roadmap


async def _get_node_or_404(
    node_id: uuid.UUID,
    roadmap_id: uuid.UUID,
    session: AsyncSession,
    *,
    load_links: bool = False,
) -> RoadmapNode:
    stmt = select(RoadmapNode).where(
        RoadmapNode.id == node_id,
        RoadmapNode.roadmap_id == roadmap_id,
    )
    if load_links:
        stmt = stmt.options(selectinload(RoadmapNode.links))
    node = await session.scalar(stmt)
    if node is None:
        raise HTTPException(status_code=404, detail="Nodul nu a fost găsit")
    return node


def _node_to_read(node: RoadmapNode, progress: ProgressRead | None) -> RoadmapNodeRead:
    return RoadmapNodeRead(
        id=node.id,
        roadmap_id=node.roadmap_id,
        parent_id=node.parent_id,
        title=node.title,
        description=node.description,
        order=node.order,
        x=node.x,
        y=node.y,
        links=[NodeLinkRead.model_validate(link) for link in node.links],
        progress=progress,
    )


@router.get("", response_model=RoadmapListResponse)
async def list_roadmaps(
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> RoadmapListResponse:
    """Lista hărților de parcurs cu procentul de completare al utilizatorului curent."""
    stmt = select(Roadmap).options(selectinload(Roadmap.nodes))
    if current_user is None or not _is_admin(current_user):
        stmt = stmt.where(Roadmap.is_published.is_(True))
    stmt = stmt.order_by(Roadmap.created_at.asc())

    roadmaps = (await session.scalars(stmt)).all()

    user_progress: dict[uuid.UUID, NodeStatus] = {}
    if current_user is not None:
        all_node_ids = [n.id for r in roadmaps for n in r.nodes]
        if all_node_ids:
            rows = (
                await session.scalars(
                    select(UserRoadmapProgress).where(
                        UserRoadmapProgress.user_id == current_user.id,
                        UserRoadmapProgress.node_id.in_(all_node_ids),
                    )
                )
            ).all()
            user_progress = {p.node_id: p.status for p in rows}

    items: list[RoadmapSummary] = []
    for roadmap in roadmaps:
        total = len(roadmap.nodes)
        completed = sum(1 for n in roadmap.nodes if user_progress.get(n.id) == NodeStatus.done)
        pct = round(completed / total * 100, 1) if total > 0 else 0.0
        items.append(
            RoadmapSummary(
                id=roadmap.id,
                title=roadmap.title,
                slug=roadmap.slug,
                description=roadmap.description,
                icon=roadmap.icon,
                is_published=roadmap.is_published,
                total_nodes=total,
                completed_nodes=completed,
                completion_pct=pct,
            )
        )

    return RoadmapListResponse(items=items, total=len(items))


@router.get("/{slug}", response_model=RoadmapDetail)
async def get_roadmap(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User | None = Depends(get_optional_user),
) -> RoadmapDetail:
    """Structura completă a hărții de parcurs, îmbinată cu progresul utilizatorului."""
    roadmap = await _get_roadmap_or_404(slug, session, load_relations=True)

    if not roadmap.is_published and (current_user is None or not _is_admin(current_user)):
        raise HTTPException(status_code=404, detail="Harta de parcurs nu a fost găsită")

    user_progress: dict[uuid.UUID, UserRoadmapProgress] = {}
    if current_user is not None:
        node_ids = [n.id for n in roadmap.nodes]
        if node_ids:
            rows = (
                await session.scalars(
                    select(UserRoadmapProgress).where(
                        UserRoadmapProgress.user_id == current_user.id,
                        UserRoadmapProgress.node_id.in_(node_ids),
                    )
                )
            ).all()
            user_progress = {p.node_id: p for p in rows}

    nodes_read: list[RoadmapNodeRead] = []
    for node in sorted(roadmap.nodes, key=lambda n: (n.order, str(n.id))):
        prog = user_progress.get(node.id)
        progress_read = (
            ProgressRead(status=prog.status, updated_at=prog.updated_at) if prog else None
        )
        nodes_read.append(_node_to_read(node, progress_read))

    return RoadmapDetail(
        id=roadmap.id,
        title=roadmap.title,
        slug=roadmap.slug,
        description=roadmap.description,
        icon=roadmap.icon,
        is_published=roadmap.is_published,
        nodes=nodes_read,
        edges=[RoadmapEdgeRead.model_validate(e) for e in roadmap.edges],
    )


@router.post("", response_model=RoadmapDetail, status_code=201)
async def create_roadmap(
    data: RoadmapCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RoadmapDetail:
    """Crează o hartă de parcurs nouă. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    existing = await session.scalar(select(Roadmap).where(Roadmap.slug == data.slug))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Există deja o hartă cu acest slug")

    roadmap = Roadmap(**data.model_dump(), created_by=current_user.id)
    session.add(roadmap)
    await session.commit()
    await session.refresh(roadmap)

    return RoadmapDetail(
        id=roadmap.id,
        title=roadmap.title,
        slug=roadmap.slug,
        description=roadmap.description,
        icon=roadmap.icon,
        is_published=roadmap.is_published,
        nodes=[],
        edges=[],
    )


@router.patch("/{slug}", response_model=RoadmapDetail)
async def update_roadmap(
    slug: str,
    data: RoadmapUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RoadmapDetail:
    """Actualizează metadatele hărții de parcurs. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session, load_relations=True)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(roadmap, field, value)

    await session.commit()
    await session.refresh(roadmap)

    nodes_read = [
        _node_to_read(n, None) for n in sorted(roadmap.nodes, key=lambda n: (n.order, str(n.id)))
    ]
    return RoadmapDetail(
        id=roadmap.id,
        title=roadmap.title,
        slug=roadmap.slug,
        description=roadmap.description,
        icon=roadmap.icon,
        is_published=roadmap.is_published,
        nodes=nodes_read,
        edges=[RoadmapEdgeRead.model_validate(e) for e in roadmap.edges],
    )


@router.delete("/{slug}", status_code=200)
async def delete_roadmap(
    slug: str,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Șterge permanent o hartă de parcurs. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)
    await session.delete(roadmap)
    await session.commit()
    return {"message": "Harta de parcurs a fost ștearsă"}


@router.post("/{slug}/nodes", response_model=RoadmapNodeRead, status_code=201)
async def create_node(
    slug: str,
    data: RoadmapNodeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RoadmapNodeRead:
    """Adaugă un nod nou în hartă. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)

    if data.parent_id is not None:
        parent = await session.scalar(
            select(RoadmapNode).where(
                RoadmapNode.id == data.parent_id,
                RoadmapNode.roadmap_id == roadmap.id,
            )
        )
        if parent is None:
            raise HTTPException(status_code=400, detail="Nodul părinte nu există în această hartă")

    node = RoadmapNode(roadmap_id=roadmap.id, **data.model_dump())
    session.add(node)
    await session.commit()

    node_with_links = await session.scalar(
        select(RoadmapNode)
        .where(RoadmapNode.id == node.id)
        .options(selectinload(RoadmapNode.links))
    )
    assert node_with_links is not None
    return _node_to_read(node_with_links, None)


@router.patch("/{slug}/nodes/{node_id}", response_model=RoadmapNodeRead)
async def update_node(
    slug: str,
    node_id: uuid.UUID,
    data: RoadmapNodeUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RoadmapNodeRead:
    """Editează un nod. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)
    node = await _get_node_or_404(node_id, roadmap.id, session, load_links=True)

    if data.parent_id is not None:
        if data.parent_id == node.id:
            raise HTTPException(status_code=400, detail="Un nod nu poate fi propriul părinte")
        parent = await session.scalar(
            select(RoadmapNode).where(
                RoadmapNode.id == data.parent_id,
                RoadmapNode.roadmap_id == roadmap.id,
            )
        )
        if parent is None:
            raise HTTPException(status_code=400, detail="Nodul părinte nu există în această hartă")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(node, field, value)

    await session.commit()
    await session.refresh(node)
    return _node_to_read(node, None)


@router.delete("/{slug}/nodes/{node_id}", status_code=200)
async def delete_node(
    slug: str,
    node_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Șterge un nod din hartă. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)
    node = await _get_node_or_404(node_id, roadmap.id, session)
    await session.delete(node)
    await session.commit()
    return {"message": "Nodul a fost șters"}


@router.post("/{slug}/nodes/{node_id}/links", response_model=NodeLinkRead, status_code=201)
async def add_node_link(
    slug: str,
    node_id: uuid.UUID,
    data: NodeLinkCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> NodeLinkRead:
    """Adaugă o resursă la un nod. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)
    node = await _get_node_or_404(node_id, roadmap.id, session)

    link = RoadmapNodeLink(node_id=node.id, **data.model_dump())
    session.add(link)
    await session.commit()
    await session.refresh(link)
    return NodeLinkRead.model_validate(link)


@router.delete("/{slug}/nodes/{node_id}/links/{link_id}", status_code=200)
async def remove_node_link(
    slug: str,
    node_id: uuid.UUID,
    link_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Elimină o resursă de la un nod. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)
    await _get_node_or_404(node_id, roadmap.id, session)

    link = await session.scalar(
        select(RoadmapNodeLink).where(
            RoadmapNodeLink.id == link_id,
            RoadmapNodeLink.node_id == node_id,
        )
    )
    if link is None:
        raise HTTPException(status_code=404, detail="Resursa nu a fost găsită")

    await session.delete(link)
    await session.commit()
    return {"message": "Resursa a fost eliminată"}


@router.post("/{slug}/edges", response_model=RoadmapEdgeRead, status_code=201)
async def create_edge(
    slug: str,
    data: RoadmapEdgeCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> RoadmapEdgeRead:
    """Adaugă o conexiune (muchie) între două noduri. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    if data.from_node_id == data.to_node_id:
        raise HTTPException(status_code=400, detail="Un nod nu se poate conecta la sine")

    roadmap = await _get_roadmap_or_404(slug, session)

    for nid in (data.from_node_id, data.to_node_id):
        node = await session.scalar(
            select(RoadmapNode).where(
                RoadmapNode.id == nid,
                RoadmapNode.roadmap_id == roadmap.id,
            )
        )
        if node is None:
            raise HTTPException(status_code=400, detail="Nodul nu aparține acestei hărți")

    existing = await session.scalar(
        select(RoadmapEdge).where(
            RoadmapEdge.from_node_id == data.from_node_id,
            RoadmapEdge.to_node_id == data.to_node_id,
        )
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="Conexiunea există deja")

    edge = RoadmapEdge(
        roadmap_id=roadmap.id,
        from_node_id=data.from_node_id,
        to_node_id=data.to_node_id,
    )
    session.add(edge)
    await session.commit()
    await session.refresh(edge)
    return RoadmapEdgeRead.model_validate(edge)


@router.delete("/{slug}/edges/{edge_id}", status_code=200)
async def delete_edge(
    slug: str,
    edge_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Elimină o conexiune. Necesită rolul de administrator."""
    if not _is_admin(current_user):
        raise HTTPException(status_code=403, detail="Permisiuni insuficiente")

    roadmap = await _get_roadmap_or_404(slug, session)

    edge = await session.scalar(
        select(RoadmapEdge).where(
            RoadmapEdge.id == edge_id,
            RoadmapEdge.roadmap_id == roadmap.id,
        )
    )
    if edge is None:
        raise HTTPException(status_code=404, detail="Conexiunea nu a fost găsită")

    await session.delete(edge)
    await session.commit()
    return {"message": "Conexiunea a fost eliminată"}


@router.put("/{slug}/nodes/{node_id}/progress", response_model=ProgressRead)
async def set_progress(
    slug: str,
    node_id: uuid.UUID,
    data: ProgressUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProgressRead:
    """Setează statusul unui nod pentru utilizatorul curent. Necesită autentificare."""
    roadmap = await _get_roadmap_or_404(slug, session)

    if not roadmap.is_published and not _is_admin(current_user):
        raise HTTPException(status_code=404, detail="Harta de parcurs nu a fost găsită")

    node = await _get_node_or_404(node_id, roadmap.id, session)

    existing = await session.scalar(
        select(UserRoadmapProgress).where(
            UserRoadmapProgress.user_id == current_user.id,
            UserRoadmapProgress.node_id == node.id,
        )
    )

    now = datetime.now(UTC)
    if existing is not None:
        existing.status = data.status
        existing.updated_at = now
        await session.commit()
        await session.refresh(existing)
        return ProgressRead(status=existing.status, updated_at=existing.updated_at)

    progress = UserRoadmapProgress(
        user_id=current_user.id,
        node_id=node.id,
        status=data.status,
        updated_at=now,
    )
    session.add(progress)
    await session.commit()
    await session.refresh(progress)
    return ProgressRead(status=progress.status, updated_at=progress.updated_at)
