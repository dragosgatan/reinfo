"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ClassMessageReadSchema, type ClassMessageRead } from "./types";

type Status = "connecting" | "live" | "error";

export function useClassChat(classId: string) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
    const ws = new WebSocket(base.replace(/^http/, "ws") + `/api/classes/${classId}/ws`);
    wsRef.current = ws;

    ws.onopen = () => setStatus("live");
    ws.onerror = () => setStatus("error");
    ws.onclose = () => setStatus("error");

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data as string);
        const msg = ClassMessageReadSchema.parse(raw);
        queryClient.setQueryData<ClassMessageRead[]>(
          ["class-messages", classId],
          (prev) => {
            if (!prev) return [msg];
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          },
        );
      } catch {
        // ignore
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [classId, queryClient]);

  return { status };
}
