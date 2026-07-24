"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { LeaderboardResponseSchema, type LeaderboardResponse } from "./types";

const WsMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("snapshot"), data: LeaderboardResponseSchema }),
  z.object({ type: z.literal("frozen"), end_time: z.string() }),
  z.object({ type: z.literal("error"), code: z.string() }),
]);

export type LiveStatus = "connecting" | "live" | "polling" | "frozen" | "off" | "error";

interface Options {
  slug: string;
  enabled: boolean;
  pollIntervalMs?: number;
}

function buildWsUrl(path: string): string {
  if (typeof window === "undefined") return "";
  const base = process.env.NEXT_PUBLIC_API_URL ?? window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

async function fetchSnapshot(slug: string): Promise<LeaderboardResponse | "frozen" | null> {
  const r = await fetch(`/api/contests/${slug}/leaderboard`, {
    credentials: "include",
  });
  if (r.status === 403) return "frozen";
  if (!r.ok) return null;
  return LeaderboardResponseSchema.parse(await r.json());
}

/** subscribe to live leaderboard snapshots over websocket, falls back to http polling; `enabled=false` turns updates off entirely */
export function useLiveLeaderboard({ slug, enabled, pollIntervalMs = 10_000 }: Options) {
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("off");
      wsRef.current?.close();
      wsRef.current = null;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    let cancelled = false;

    function clearPoll() {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }

    async function startPolling() {
      if (cancelled || pollRef.current) return;
      setStatus("polling");
      const tick = async () => {
        const snap = await fetchSnapshot(slug).catch(() => null);
        if (cancelled) return;
        if (snap === "frozen") {
          setStatus("frozen");
          return;
        }
        if (snap) setData(snap);
      };
      await tick();
      pollRef.current = setInterval(tick, pollIntervalMs);
    }

    function openSocket() {
      const url = buildWsUrl(`/api/contests/${slug}/leaderboard/ws`);
      if (!url) {
        startPolling();
        return;
      }

      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        startPolling();
        return;
      }
      wsRef.current = ws;
      setStatus("connecting");

      ws.onmessage = (ev) => {
        try {
          const parsed = WsMessageSchema.parse(JSON.parse(ev.data));
          if (parsed.type === "snapshot") {
            setData(parsed.data);
            setStatus("live");
            clearPoll();
          } else if (parsed.type === "frozen") {
            setStatus("frozen");
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        // onclose will run, let it handle the fallback so we don't poll twice
      };

      ws.onclose = (ev) => {
        if (cancelled) return;
        wsRef.current = null;
        // 4403 = frozen (handled in onmessage); 4404 = not found
        if (ev.code === 4404) {
          setStatus("error");
          return;
        }
        if (ev.code === 4403) {
          setStatus("frozen");
          return;
        }
        startPolling();
      };
    }

    openSocket();

    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
      clearPoll();
    };
  }, [slug, enabled, pollIntervalMs]);

  return { data, status };
}
