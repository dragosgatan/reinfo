"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { Pause, Play, Radio, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { ContestDetailSchema, FriendshipReadSchema } from "@/lib/types";
import { useLiveLeaderboard } from "@/lib/use-live-leaderboard";
import { useFlipRows } from "@/lib/use-flip";
import { CountdownTimer } from "@/components/contests/countdown-timer";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { z } from "zod";

const ORDINAL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

interface Props {
  slug: string;
}

function cellTone(score: number, total: number): string {
  if (total <= 0 || score <= 0) return "text-muted-foreground";
  if (score >= total) return "text-emerald-600 dark:text-emerald-400 font-medium";
  return "text-amber-600 dark:text-amber-400 font-medium";
}

export default function LeaderboardClient({ slug }: Props) {
  const t = useTranslations("contests");
  const [liveEnabled, setLiveEnabled] = useState(true);
  const [friendsOnly, setFriendsOnly] = useState(false);
  const { isAuthenticated } = useAuth();

  const { data: contest } = useQuery({
    queryKey: ["contest", slug],
    queryFn: () => api.get(`/api/contests/${slug}`, ContestDetailSchema),
  });

  const isOngoing = contest?.status === "ongoing";

  const { data: lb, status: liveStatus } = useLiveLeaderboard({
    slug,
    enabled: isOngoing ? liveEnabled : false,
  });

  // For past contests we don't need live updates; one-shot fetch via react-query.
  const { data: lbStatic } = useQuery({
    queryKey: ["leaderboard-static", slug],
    queryFn: async () => {
      const r = await fetch(`/api/contests/${slug}/leaderboard`, {
        credentials: "include",
      });
      if (r.status === 403) return "frozen" as const;
      if (!r.ok) throw new Error("failed");
      return (await r.json()) as import("@/lib/types").LeaderboardResponse;
    },
    enabled: !isOngoing,
  });

  const board = isOngoing ? lb : lbStatic === "frozen" ? null : lbStatic ?? null;
  const frozen = liveStatus === "frozen" || lbStatic === "frozen";

  const problemEntries = useMemo(
    () => contest?.problems ?? [],
    [contest?.problems],
  );
  const problemTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const p of problemEntries) totals[p.problem_slug] = p.score_total;
    return totals;
  }, [problemEntries]);

  const { data: friends = [] } = useQuery({
    queryKey: ["social", "friends"],
    queryFn: () => api.get("/api/social/friends", z.array(FriendshipReadSchema)),
    enabled: isAuthenticated && friendsOnly,
    staleTime: 30_000,
  });

  const friendIds = useMemo(() => new Set(friends.map((f) => f.friend_id)), [friends]);

  const visibleEntries = useMemo(() => {
    const entries = board?.entries ?? [];
    if (!friendsOnly || !isAuthenticated) return entries;
    return entries.filter((e) => friendIds.has(e.user_id));
  }, [board?.entries, friendsOnly, isAuthenticated, friendIds]);

  const rowRefs = useRef(new Map<string, HTMLTableRowElement | null>());
  const orderedKeys = useMemo(
    () => visibleEntries.map((e) => e.user_id),
    [visibleEntries],
  );

  useFlipRows(orderedKeys, (k) => rowRefs.current.get(k) ?? null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2">
        <Link
          href={`/concursuri/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {contest?.title ?? slug}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {t("leaderboard")}
          </h1>
          {contest && isOngoing && (
            <div className="mt-1">
              <CountdownTimer
                targetDate={contest.end_time}
                label={t("endsIn")}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
        {isAuthenticated && (
          <Button
            variant={friendsOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFriendsOnly((v) => !v)}
            className="gap-2"
          >
            <Users className="h-3.5 w-3.5" />
            Prieteni
          </Button>
        )}
        {isOngoing && !frozen && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLiveEnabled((v) => !v)}
            className="gap-2"
          >
            {liveEnabled ? (
              <>
                <Pause className="h-3.5 w-3.5" />
                {t("pauseLive")}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" />
                {t("resumeLive")}
              </>
            )}
            <LiveDot status={liveStatus} />
          </Button>
        )}
        </div>
      </div>

      {frozen ? (
        <div className="rounded-md border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          <Radio className="mx-auto mb-2 h-4 w-4" />
          {t("frozenUntilEnd")}
        </div>
      ) : !board ? (
        <p className="text-sm text-muted-foreground">{t("loadingLeaderboard")}</p>
      ) : visibleEntries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {friendsOnly ? "Niciun prieten în clasament." : t("noEntries")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("rank")}</TableHead>
                <TableHead>{t("participant")}</TableHead>
                {problemEntries.map((p, i) => (
                  <TableHead
                    key={p.problem_slug}
                    className="w-16 text-center"
                    title={p.problem_title}
                  >
                    {ORDINAL_LABELS[i] ?? String(i + 1)}
                  </TableHead>
                ))}
                <TableHead className="text-right">{t("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleEntries.map((entry) => (
                <TableRow
                  key={entry.user_id}
                  ref={(el) => {
                    rowRefs.current.set(entry.user_id, el);
                  }}
                  className={cn(
                    entry.rank === 1 && "bg-amber-50/40 dark:bg-amber-950/20",
                  )}
                >
                  <TableCell className="font-mono text-muted-foreground">
                    {entry.rank}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/profile/${entry.username}`}
                      className="font-medium hover:underline"
                    >
                      {entry.display_name}
                    </Link>
                  </TableCell>
                  {problemEntries.map((p) => {
                    const score = entry.problem_scores[p.problem_slug] ?? 0;
                    const total = problemTotals[p.problem_slug] ?? 0;
                    return (
                      <TableCell
                        key={p.problem_slug}
                        className={cn(
                          "text-center font-mono text-sm",
                          cellTone(score, total),
                        )}
                      >
                        {score > 0 ? score : "—"}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right font-semibold tabular-nums">
                    {entry.total_score}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function LiveDot({ status }: { status: ReturnType<typeof useLiveLeaderboard>["status"] }) {
  const color =
    status === "live"
      ? "bg-emerald-500"
      : status === "polling"
        ? "bg-amber-500"
        : status === "connecting"
          ? "bg-muted-foreground"
          : "bg-muted-foreground/50";
  return (
    <span className="relative inline-flex h-2 w-2">
      {status === "live" && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", color)} />
    </span>
  );
}
