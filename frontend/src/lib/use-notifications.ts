"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NotificationReadSchema, DirectMessageReadSchema, type NotificationRead, type DirectMessageRead } from "./types";
import { useAuth } from "./auth";

export function useNotificationsWs() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;

    const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
    const ws = new WebSocket(base.replace(/^http/, "ws") + "/api/social/ws/notifications");
    wsRef.current = ws;

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string);

        if (raw.type === "dm") {
          const dm = DirectMessageReadSchema.parse({
            id: raw.id,
            class_id: raw.class_id,
            sender_id: raw.sender_id,
            sender_username: raw.sender_username,
            sender_display_name: raw.sender_display_name,
            sender_avatar_url: raw.sender_avatar_url,
            receiver_id: raw.receiver_id,
            body: raw.body,
            read: raw.read,
            created_at: raw.created_at,
          });
          queryClient.setQueryData<DirectMessageRead[]>(
            ["dm", raw.class_id, raw.sender_username],
            (prev) => (prev ? [...prev, dm] : [dm]),
          );
          queryClient.invalidateQueries({ queryKey: ["dm-unread"] });
          return;
        }

        const notif = NotificationReadSchema.parse(raw);
        queryClient.setQueryData<NotificationRead[]>(
          ["social", "notifications"],
          (prev) => (prev ? [notif, ...prev] : [notif]),
        );
      } catch {
        // ignore malformed messages
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [isAuthenticated, queryClient]);
}
