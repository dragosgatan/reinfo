---
name: project_social_feature
description: Social features — friend requests, friendships, notifications with WebSocket, activity feed, friends leaderboard filter
metadata:
  type: project
---

Friends system fully implemented (2026-05-19). Migration: `o3p4q5r6s7t8_add_social`.

Tables: `friend_requests` (sender_id, receiver_id, status enum pending/accepted/rejected), `friendships` (two rows per pair for easy querying), `notifications` (user_id, type enum friend_request/friend_accepted, payload JSON text, read bool).

Backend: `app/models/social.py`, `app/schemas/social.py`, `app/routers/social.py` mounted at `/api/social/`.
Realtime: `NotificationHub` in `realtime.py`, `NOTIFICATION_CHANNEL = "reinfo_notifications"`, payload format `<user_id>:<json>`.

Frontend:
- `/prieteni` page with tabs: Activitate / Prieteni / Cereri primite
- `NotificationBell` in header (WS-connected, unread badge)
- `AddFriendButton` on profile page `/u/[username]`
- Friends tab added to own profile's `ProfileTabs`
- Friends-only toggle on contest leaderboard `/concursuri/[slug]/clasament`
- Components in `src/components/social/`

**Why:** Social layer for InfoEducatie rubrics (community features).
**How to apply:** Run `alembic upgrade head` before testing. Online status = last_active_at within 5 minutes.
