"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DuelReadSchema, type DuelRead } from "./types";

type DuelWsStatus = "connecting" | "live" | "error" | "closed";

interface DuelWsMessage {
  type: "state" | "timer";
  data?: unknown;
  seconds_remaining?: number;
}

interface UseDuelWsResult {
  duel: DuelRead | null;
  secondsRemaining: number | null;
  status: DuelWsStatus;
}

export function useDuelWs(duelId: string | null, enabled = true): UseDuelWsResult {
  const [duel, setDuel] = useState<DuelRead | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [status, setStatus] = useState<DuelWsStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearCountdown = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const startCountdown = useCallback(
    (initialSeconds: number) => {
      clearCountdown();
      setSecondsRemaining(initialSeconds);
      countdownRef.current = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev === null || prev <= 0) {
            clearCountdown();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    },
    [clearCountdown],
  );

  useEffect(() => {
    if (!enabled || !duelId) return;

    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const host = window.location.host;
    const url = `${proto}://${host}/api/duels/${duelId}/ws`;

    let cancelled = false;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus("connecting");

    ws.onopen = () => {
      if (!cancelled) setStatus("live");
    };

    ws.onmessage = (event) => {
      if (cancelled) return;
      try {
        const msg = JSON.parse(event.data as string) as DuelWsMessage;
        if (msg.type === "state" && msg.data) {
          const parsed = DuelReadSchema.safeParse(msg.data);
          if (parsed.success) {
            setDuel(parsed.data);
          }
        }
        if (msg.type === "timer" && typeof msg.seconds_remaining === "number") {
          startCountdown(msg.seconds_remaining);
        }
        if (msg.type === "state" && typeof (msg as { seconds_remaining?: number }).seconds_remaining === "number") {
          startCountdown((msg as { seconds_remaining?: number }).seconds_remaining!);
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onerror = () => {
      if (!cancelled) setStatus("error");
    };

    ws.onclose = () => {
      if (!cancelled) setStatus("closed");
    };

    return () => {
      cancelled = true;
      clearCountdown();
      ws.close();
    };
  }, [duelId, enabled, startCountdown, clearCountdown]);

  return { duel, secondsRemaining, status };
}
