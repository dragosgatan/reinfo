"""tests for /api/roadmaps/* endpoints"""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.roadmap import Roadmap, RoadmapEdge, RoadmapNode
from app.models.user import User, UserRole
from app.security import hash_password

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


async def _make_roadmap(
    db: AsyncSession,
    slug: str = "test-roadmap",
    is_published: bool = True,
) -> Roadmap:
    roadmap = Roadmap(
        title="Test Roadmap",
        slug=slug,
        description="A test roadmap.",
        is_published=is_published,
    )
    db.add(roadmap)
    await db.commit()
    await db.refresh(roadmap)
    return roadmap


async def _make_node(
    db: AsyncSession,
    roadmap: Roadmap,
    title: str = "Test Node",
    order: int = 0,
    x: float = 50.0,
    y: float = 50.0,
) -> RoadmapNode:
    node = RoadmapNode(
        roadmap_id=roadmap.id,
        title=title,
        order=order,
        x=x,
        y=y,
    )
    db.add(node)
    await db.commit()
    await db.refresh(node)
    return node


@pytest.mark.asyncio
async def test_list_roadmaps_anonymous_sees_published(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_roadmap(db_session, slug="pub-r", is_published=True)
    await _make_roadmap(db_session, slug="draft-r", is_published=False)

    r = await client.get("/api/roadmaps")
    assert r.status_code == 200
    slugs = [i["slug"] for i in r.json()["items"]]
    assert "pub-r" in slugs
    assert "draft-r" not in slugs


@pytest.mark.asyncio
async def test_list_roadmaps_admin_sees_drafts(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "admin1", role=UserRole.admin)
    await _make_roadmap(db_session, slug="pub-r2", is_published=True)
    await _make_roadmap(db_session, slug="draft-r2", is_published=False)
    await _login(client, "admin1")

    r = await client.get("/api/roadmaps")
    assert r.status_code == 200
    slugs = [i["slug"] for i in r.json()["items"]]
    assert "draft-r2" in slugs


@pytest.mark.asyncio
async def test_list_roadmaps_completion_pct(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student1")
    roadmap = await _make_roadmap(db_session, slug="pct-r")
    node = await _make_node(db_session, roadmap)
    await _login(client, "student1")

    r = await client.get("/api/roadmaps")
    assert r.status_code == 200
    item = next(i for i in r.json()["items"] if i["slug"] == "pct-r")
    assert item["total_nodes"] == 1
    assert item["completed_nodes"] == 0
    assert item["completion_pct"] == 0.0

    await client.put(
        f"/api/roadmaps/pct-r/nodes/{node.id}/progress",
        json={"status": "done"},
    )

    r2 = await client.get("/api/roadmaps")
    item2 = next(i for i in r2.json()["items"] if i["slug"] == "pct-r")
    assert item2["completed_nodes"] == 1
    assert item2["completion_pct"] == 100.0


@pytest.mark.asyncio
async def test_get_roadmap_detail(client: AsyncClient, db_session: AsyncSession) -> None:
    roadmap = await _make_roadmap(db_session, slug="detail-r")
    node_a = await _make_node(db_session, roadmap, title="Alpha", order=0)
    node_b = await _make_node(db_session, roadmap, title="Beta", order=1)
    edge = RoadmapEdge(
        roadmap_id=roadmap.id,
        from_node_id=node_a.id,
        to_node_id=node_b.id,
    )
    db_session.add(edge)
    await db_session.commit()

    r = await client.get("/api/roadmaps/detail-r")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "detail-r"
    assert len(body["nodes"]) == 2
    assert len(body["edges"]) == 1
    assert body["nodes"][0]["progress"] is None


@pytest.mark.asyncio
async def test_get_roadmap_detail_with_user_progress(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student2")
    roadmap = await _make_roadmap(db_session, slug="prog-r")
    node = await _make_node(db_session, roadmap, title="Node A")
    await _login(client, "student2")

    await client.put(
        f"/api/roadmaps/prog-r/nodes/{node.id}/progress",
        json={"status": "in_progress"},
    )

    r = await client.get("/api/roadmaps/prog-r")
    assert r.status_code == 200
    assert r.json()["nodes"][0]["progress"]["status"] == "in_progress"


@pytest.mark.asyncio
async def test_get_draft_roadmap_anonymous_returns_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_roadmap(db_session, slug="hidden-r", is_published=False)
    r = await client.get("/api/roadmaps/hidden-r")
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_get_draft_roadmap_admin_succeeds(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "admin2", role=UserRole.admin)
    await _make_roadmap(db_session, slug="hidden-r2", is_published=False)
    await _login(client, "admin2")

    r = await client.get("/api/roadmaps/hidden-r2")
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_create_roadmap_admin(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin3", role=UserRole.admin)
    await _login(client, "admin3")

    r = await client.post(
        "/api/roadmaps",
        json={
            "title": "Roadmap Nou",
            "slug": "roadmap-nou",
            "description": "Descriere.",
        },
    )
    assert r.status_code == 201
    assert r.json()["slug"] == "roadmap-nou"
    assert r.json()["nodes"] == []


@pytest.mark.asyncio
async def test_create_roadmap_student_forbidden(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student3")
    await _login(client, "student3")

    r = await client.post(
        "/api/roadmaps",
        json={"title": "Forbidden", "slug": "forbidden-r"},
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_create_roadmap_anonymous_returns_401(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    r = await client.post(
        "/api/roadmaps",
        json={"title": "Anon", "slug": "anon-r"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_create_roadmap_duplicate_slug(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin4", role=UserRole.admin)
    await _make_roadmap(db_session, slug="dup-r")
    await _login(client, "admin4")

    r = await client.post(
        "/api/roadmaps",
        json={"title": "Dup", "slug": "dup-r"},
    )
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_update_roadmap(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin5", role=UserRole.admin)
    await _make_roadmap(db_session, slug="upd-r")
    await _login(client, "admin5")

    r = await client.patch("/api/roadmaps/upd-r", json={"title": "Updated"})
    assert r.status_code == 200
    assert r.json()["title"] == "Updated"


@pytest.mark.asyncio
async def test_delete_roadmap(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin6", role=UserRole.admin)
    await _make_roadmap(db_session, slug="del-r")
    await _login(client, "admin6")

    r = await client.delete("/api/roadmaps/del-r")
    assert r.status_code == 200

    r2 = await client.get("/api/roadmaps/del-r")
    assert r2.status_code == 404


@pytest.mark.asyncio
async def test_create_node(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin7", role=UserRole.admin)
    await _make_roadmap(db_session, slug="node-r", is_published=False)
    await _login(client, "admin7")

    r = await client.post(
        "/api/roadmaps/node-r/nodes",
        json={"title": "Sortări", "description": "Algoritmi de sortare.", "x": 20.0, "y": 10.0},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == "Sortări"
    assert body["x"] == 20.0
    assert body["links"] == []


@pytest.mark.asyncio
async def test_create_node_invalid_parent(client: AsyncClient, db_session: AsyncSession) -> None:
    import uuid

    await _make_user(db_session, "admin8", role=UserRole.admin)
    await _make_roadmap(db_session, slug="node-r2", is_published=False)
    await _login(client, "admin8")

    r = await client.post(
        "/api/roadmaps/node-r2/nodes",
        json={"title": "Child", "parent_id": str(uuid.uuid4())},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_update_node(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin9", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="upd-node-r", is_published=False)
    node = await _make_node(db_session, roadmap, title="Old Title")
    await _login(client, "admin9")

    r = await client.patch(
        f"/api/roadmaps/upd-node-r/nodes/{node.id}",
        json={"title": "New Title", "x": 30.0},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "New Title"
    assert r.json()["x"] == 30.0


@pytest.mark.asyncio
async def test_delete_node(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin10", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="del-node-r", is_published=False)
    node = await _make_node(db_session, roadmap)
    await _login(client, "admin10")

    r = await client.delete(f"/api/roadmaps/del-node-r/nodes/{node.id}")
    assert r.status_code == 200

    r2 = await client.get("/api/roadmaps/del-node-r")
    assert r2.json()["nodes"] == []


@pytest.mark.asyncio
async def test_add_node_link(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin11", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="link-r", is_published=False)
    node = await _make_node(db_session, roadmap)
    await _login(client, "admin11")

    r = await client.post(
        f"/api/roadmaps/link-r/nodes/{node.id}/links",
        json={
            "url": "https://example.com",
            "title": "Resursă externă",
            "link_type": "external",
        },
    )
    assert r.status_code == 201
    assert r.json()["url"] == "https://example.com"
    assert r.json()["link_type"] == "external"


@pytest.mark.asyncio
async def test_remove_node_link(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin12", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="rmlink-r", is_published=False)
    node = await _make_node(db_session, roadmap)
    await _login(client, "admin12")

    r_add = await client.post(
        f"/api/roadmaps/rmlink-r/nodes/{node.id}/links",
        json={"url": "https://x.com", "title": "X", "link_type": "external"},
    )
    link_id = r_add.json()["id"]

    r_del = await client.delete(f"/api/roadmaps/rmlink-r/nodes/{node.id}/links/{link_id}")
    assert r_del.status_code == 200


@pytest.mark.asyncio
async def test_create_edge(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin13", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="edge-r", is_published=False)
    node_a = await _make_node(db_session, roadmap, title="A")
    node_b = await _make_node(db_session, roadmap, title="B")
    await _login(client, "admin13")

    r = await client.post(
        "/api/roadmaps/edge-r/edges",
        json={"from_node_id": str(node_a.id), "to_node_id": str(node_b.id)},
    )
    assert r.status_code == 201
    assert r.json()["from_node_id"] == str(node_a.id)


@pytest.mark.asyncio
async def test_create_edge_duplicate_returns_409(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "admin14", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="dup-edge-r", is_published=False)
    node_a = await _make_node(db_session, roadmap, title="A")
    node_b = await _make_node(db_session, roadmap, title="B")
    await _login(client, "admin14")

    payload = {"from_node_id": str(node_a.id), "to_node_id": str(node_b.id)}
    await client.post("/api/roadmaps/dup-edge-r/edges", json=payload)
    r = await client.post("/api/roadmaps/dup-edge-r/edges", json=payload)
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_create_edge_self_loop_returns_400(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "admin15", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="loop-r", is_published=False)
    node = await _make_node(db_session, roadmap)
    await _login(client, "admin15")

    r = await client.post(
        "/api/roadmaps/loop-r/edges",
        json={"from_node_id": str(node.id), "to_node_id": str(node.id)},
    )
    assert r.status_code == 400


@pytest.mark.asyncio
async def test_delete_edge(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "admin16", role=UserRole.admin)
    roadmap = await _make_roadmap(db_session, slug="del-edge-r", is_published=False)
    node_a = await _make_node(db_session, roadmap, title="A")
    node_b = await _make_node(db_session, roadmap, title="B")
    await _login(client, "admin16")

    r_create = await client.post(
        "/api/roadmaps/del-edge-r/edges",
        json={"from_node_id": str(node_a.id), "to_node_id": str(node_b.id)},
    )
    edge_id = r_create.json()["id"]

    r_del = await client.delete(f"/api/roadmaps/del-edge-r/edges/{edge_id}")
    assert r_del.status_code == 200

    r_detail = await client.get("/api/roadmaps/del-edge-r")
    assert r_detail.json()["edges"] == []


@pytest.mark.asyncio
async def test_set_progress(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student4")
    roadmap = await _make_roadmap(db_session, slug="prog2-r")
    node = await _make_node(db_session, roadmap)
    await _login(client, "student4")

    r = await client.put(
        f"/api/roadmaps/prog2-r/nodes/{node.id}/progress",
        json={"status": "done"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "done"


@pytest.mark.asyncio
async def test_set_progress_idempotent(client: AsyncClient, db_session: AsyncSession) -> None:
    await _make_user(db_session, "student5")
    roadmap = await _make_roadmap(db_session, slug="idem-r")
    node = await _make_node(db_session, roadmap)
    await _login(client, "student5")

    await client.put(
        f"/api/roadmaps/idem-r/nodes/{node.id}/progress",
        json={"status": "in_progress"},
    )
    r = await client.put(
        f"/api/roadmaps/idem-r/nodes/{node.id}/progress",
        json={"status": "done"},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "done"

    r2 = await client.get("/api/roadmaps/idem-r")
    assert r2.json()["nodes"][0]["progress"]["status"] == "done"


@pytest.mark.asyncio
async def test_set_progress_anonymous_returns_401(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    roadmap = await _make_roadmap(db_session, slug="anon-prog-r")
    node = await _make_node(db_session, roadmap)

    r = await client.put(
        f"/api/roadmaps/anon-prog-r/nodes/{node.id}/progress",
        json={"status": "done"},
    )
    assert r.status_code == 401


@pytest.mark.asyncio
async def test_set_progress_on_unpublished_student_returns_404(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student6")
    roadmap = await _make_roadmap(db_session, slug="unp-prog-r", is_published=False)
    node = await _make_node(db_session, roadmap)
    await _login(client, "student6")

    r = await client.put(
        f"/api/roadmaps/unp-prog-r/nodes/{node.id}/progress",
        json={"status": "done"},
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_node_status_not_started_by_default(
    client: AsyncClient, db_session: AsyncSession
) -> None:
    await _make_user(db_session, "student7")
    roadmap = await _make_roadmap(db_session, slug="def-stat-r")
    await _make_node(db_session, roadmap)
    await _login(client, "student7")

    r = await client.get("/api/roadmaps/def-stat-r")
    assert r.status_code == 200
    assert r.json()["nodes"][0]["progress"] is None
