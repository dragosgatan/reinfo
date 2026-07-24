"""social features: friend requests, friendships, notifications, activity feed"""

import json
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.dependencies import get_current_user
from app.models.problem import Problem
from app.models.social import (
    FriendRequest,
    FriendRequestStatus,
    Friendship,
    Notification,
    NotificationType,
)
from app.models.submission import Submission, Verdict
from app.models.user import User
from app.realtime import notification_hub, publish_notification
from app.schemas.social import (
    ActivityFeedItem,
    FriendRequestRead,
    FriendshipRead,
    FriendStatusResponse,
    NotificationRead,
)

router = APIRouter(prefix="/api/social", tags=["social"])

_ONLINE_THRESHOLD_MINUTES = 5


def _is_online(last_active: datetime) -> bool:
    return datetime.now(UTC) - last_active < timedelta(minutes=_ONLINE_THRESHOLD_MINUTES)


def _build_friend_request_read(req: FriendRequest) -> FriendRequestRead:
    return FriendRequestRead(
        id=req.id,
        sender_id=req.sender_id,
        receiver_id=req.receiver_id,
        status=req.status,
        created_at=req.created_at,
        sender_username=req.sender.username,
        sender_display_name=req.sender.display_name,
        sender_avatar_url=req.sender.avatar_url,
    )


async def _create_notification(
    session: AsyncSession,
    user_id: uuid.UUID,
    notif_type: NotificationType,
    payload: dict,
) -> Notification:
    now = datetime.now(UTC)
    notif = Notification(
        user_id=user_id,
        type=notif_type,
        payload=json.dumps(payload),
        created_at=now,
    )
    session.add(notif)
    await session.flush()
    await publish_notification(
        session,
        str(user_id),
        json.dumps(
            {
                "id": str(notif.id),
                "type": str(notif.type),
                "payload": payload,
                "read": False,
                "created_at": now.isoformat(),
            }
        ),
    )
    return notif


@router.get("/friends/status/{username}", response_model=FriendStatusResponse)
async def get_friend_status(
    username: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FriendStatusResponse:
    """return friendship status with another user"""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    if target.id == user.id:
        return FriendStatusResponse(
            is_friend=False, pending_sent=False, pending_received=False, request_id=None
        )

    friendship = await session.scalar(
        select(Friendship).where(Friendship.user_id == user.id, Friendship.friend_id == target.id)
    )
    if friendship:
        return FriendStatusResponse(
            is_friend=True, pending_sent=False, pending_received=False, request_id=None
        )

    sent = await session.scalar(
        select(FriendRequest).where(
            FriendRequest.sender_id == user.id,
            FriendRequest.receiver_id == target.id,
            FriendRequest.status == FriendRequestStatus.pending,
        )
    )
    if sent:
        return FriendStatusResponse(
            is_friend=False, pending_sent=True, pending_received=False, request_id=sent.id
        )

    received = await session.scalar(
        select(FriendRequest).where(
            FriendRequest.sender_id == target.id,
            FriendRequest.receiver_id == user.id,
            FriendRequest.status == FriendRequestStatus.pending,
        )
    )
    if received:
        return FriendStatusResponse(
            is_friend=False, pending_sent=False, pending_received=True, request_id=received.id
        )

    return FriendStatusResponse(
        is_friend=False, pending_sent=False, pending_received=False, request_id=None
    )


@router.post("/friends/request/{username}", response_model=FriendRequestRead, status_code=201)
async def send_friend_request(
    username: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FriendRequestRead:
    """send a friend request"""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")
    if target.id == user.id:
        raise HTTPException(status_code=400, detail="Nu poți trimite cerere ție însuți")

    existing_friendship = await session.scalar(
        select(Friendship).where(Friendship.user_id == user.id, Friendship.friend_id == target.id)
    )
    if existing_friendship:
        raise HTTPException(status_code=400, detail="Ești deja prieten cu acest utilizator")

    existing_request = await session.scalar(
        select(FriendRequest).where(
            FriendRequest.sender_id == user.id,
            FriendRequest.receiver_id == target.id,
            FriendRequest.status == FriendRequestStatus.pending,
        )
    )
    if existing_request:
        raise HTTPException(status_code=400, detail="Cererea a fost deja trimisă")

    req = FriendRequest(sender_id=user.id, receiver_id=target.id)
    session.add(req)
    await session.flush()

    await session.refresh(req, ["sender", "receiver"])

    await _create_notification(
        session,
        target.id,
        NotificationType.friend_request,
        {
            "request_id": str(req.id),
            "from_username": user.username,
            "from_display_name": user.display_name,
            "from_avatar_url": user.avatar_url,
        },
    )

    await session.commit()
    await session.refresh(req, ["sender", "receiver"])
    return _build_friend_request_read(req)


@router.post("/friends/request/{request_id}/accept", response_model=FriendRequestRead)
async def accept_friend_request(
    request_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FriendRequestRead:
    """accept an incoming friend request"""
    req = await session.scalar(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.receiver_id == user.id,
            FriendRequest.status == FriendRequestStatus.pending,
        )
    )
    if req is None:
        raise HTTPException(status_code=404, detail="Cererea nu a fost găsită")

    req.status = FriendRequestStatus.accepted

    session.add(Friendship(user_id=user.id, friend_id=req.sender_id))
    session.add(Friendship(user_id=req.sender_id, friend_id=user.id))

    await session.flush()
    await session.refresh(req, ["sender", "receiver"])

    await _create_notification(
        session,
        req.sender_id,
        NotificationType.friend_accepted,
        {
            "from_username": user.username,
            "from_display_name": user.display_name,
            "from_avatar_url": user.avatar_url,
        },
    )

    await session.commit()
    await session.refresh(req, ["sender", "receiver"])
    return _build_friend_request_read(req)


@router.post("/friends/request/{request_id}/reject", response_model=FriendRequestRead)
async def reject_friend_request(
    request_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> FriendRequestRead:
    """decline an incoming friend request"""
    req = await session.scalar(
        select(FriendRequest).where(
            FriendRequest.id == request_id,
            FriendRequest.receiver_id == user.id,
            FriendRequest.status == FriendRequestStatus.pending,
        )
    )
    if req is None:
        raise HTTPException(status_code=404, detail="Cererea nu a fost găsită")

    req.status = FriendRequestStatus.rejected
    await session.commit()
    await session.refresh(req, ["sender", "receiver"])
    return _build_friend_request_read(req)


@router.delete("/friends/{username}", status_code=204)
async def remove_friend(
    username: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """remove a friend from the friends list"""
    target = await session.scalar(select(User).where(User.username == username))
    if target is None:
        raise HTTPException(status_code=404, detail="Utilizatorul nu a fost găsit")

    await session.execute(
        delete(Friendship).where(Friendship.user_id == user.id, Friendship.friend_id == target.id)
    )
    await session.execute(
        delete(Friendship).where(Friendship.user_id == target.id, Friendship.friend_id == user.id)
    )
    await session.commit()


@router.get("/friends", response_model=list[FriendshipRead])
async def list_friends(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendshipRead]:
    """list friends with their online status"""
    rows = await session.execute(select(Friendship).where(Friendship.user_id == user.id))
    friendships = rows.scalars().all()

    friend_ids = [f.friend_id for f in friendships]
    if not friend_ids:
        return []

    users_rows = await session.execute(select(User).where(User.id.in_(friend_ids)))
    users_by_id = {u.id: u for u in users_rows.scalars()}

    result = []
    for f in friendships:
        friend = users_by_id.get(f.friend_id)
        if friend is None:
            continue
        result.append(
            FriendshipRead(
                id=f.id,
                friend_id=friend.id,
                friend_username=friend.username,
                friend_display_name=friend.display_name,
                friend_avatar_url=friend.avatar_url,
                online=_is_online(friend.last_active_at),
                last_active_at=friend.last_active_at,
                created_at=f.created_at,
            )
        )

    result.sort(key=lambda x: (not x.online, x.friend_display_name))
    return result


@router.get("/friends/requests", response_model=list[FriendRequestRead])
async def list_friend_requests(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[FriendRequestRead]:
    """list incoming pending friend requests"""
    rows = await session.execute(
        select(FriendRequest).where(
            FriendRequest.receiver_id == user.id,
            FriendRequest.status == FriendRequestStatus.pending,
        )
    )
    reqs = rows.scalars().all()

    result = []
    for req in reqs:
        await session.refresh(req, ["sender", "receiver"])
        result.append(_build_friend_request_read(req))
    return result


@router.get("/activity", response_model=list[ActivityFeedItem])
async def get_activity_feed(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[ActivityFeedItem]:
    """recent friend activity (last 50 ac submissions)"""
    rows = await session.execute(select(Friendship.friend_id).where(Friendship.user_id == user.id))
    friend_ids = [r for (r,) in rows]
    if not friend_ids:
        return []

    sub_rows = await session.execute(
        select(Submission, User, Problem)
        .join(User, Submission.user_id == User.id)
        .join(Problem, Submission.problem_id == Problem.id)
        .where(
            Submission.user_id.in_(friend_ids),
            Submission.verdict == Verdict.AC,
        )
        .order_by(Submission.created_at.desc())
        .limit(50)
    )

    result = []
    for sub, u, prob in sub_rows:
        result.append(
            ActivityFeedItem(
                submission_id=sub.id,
                user_id=u.id,
                username=u.username,
                display_name=u.display_name,
                avatar_url=u.avatar_url,
                problem_slug=prob.slug,
                problem_title=prob.title,
                verdict=sub.verdict,
                score=sub.score or 0,
                language=sub.language,
                created_at=sub.created_at,
            )
        )
    return result


@router.get("/notifications", response_model=list[NotificationRead])
async def list_notifications(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> list[NotificationRead]:
    """list the user's notifications (most recent 50)"""
    rows = await session.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return [NotificationRead.model_validate(n) for n in rows.scalars()]


@router.patch("/notifications/{notification_id}/read", response_model=NotificationRead)
async def mark_notification_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> NotificationRead:
    """mark a notification as read"""
    notif = await session.scalar(
        select(Notification).where(
            Notification.id == notification_id, Notification.user_id == user.id
        )
    )
    if notif is None:
        raise HTTPException(status_code=404, detail="Notificarea nu a fost găsită")
    notif.read = True
    await session.commit()
    return NotificationRead.model_validate(notif)


@router.patch("/notifications/read-all", status_code=204)
async def mark_all_notifications_read(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
) -> None:
    """mark all notifications as read"""
    rows = await session.execute(
        select(Notification).where(Notification.user_id == user.id, Notification.read.is_(False))
    )
    for notif in rows.scalars():
        notif.read = True
    await session.commit()


@router.websocket("/ws/notifications")
async def notifications_ws(
    websocket: WebSocket,
    session: AsyncSession = Depends(get_session),
) -> None:
    """websocket for real-time notification delivery"""
    from datetime import UTC

    from app.dependencies import SESSION_COOKIE_NAME

    token = websocket.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        await websocket.close(code=4001)
        return

    from app.models.user import Session as DbSession

    db_session = await session.scalar(
        select(DbSession).where(
            DbSession.token == token,
            DbSession.expires_at > datetime.now(UTC),
        )
    )
    if db_session is None:
        await websocket.close(code=4001)
        return

    user = await session.get(User, db_session.user_id)
    if user is None:
        await websocket.close(code=4001)
        return

    await websocket.accept()
    user_id_str = str(user.id)
    await notification_hub.connect(user_id_str, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await notification_hub.disconnect(user_id_str, websocket)
