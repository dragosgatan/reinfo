"use client";

import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { CtfScoreboardResponseSchema } from "@/lib/types";
import { cn } from "@/lib/utils";

const _POLL_INTERVAL_MS = 20 * 1000;

export function CtfScoreboardClient() {
  const t = useTranslations("ctf");
  const locale = useLocale();

  const { data, isLoading } = useQuery({
    queryKey: ["ctf-scoreboard"],
    queryFn: () => api.get("/api/ctf/scoreboard", CtfScoreboardResponseSchema),
    refetchInterval: _POLL_INTERVAL_MS,
    staleTime: 10 * 1000,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <Trophy className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            {t("scoreboardTitle")}
          </h1>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("scoreboardSubtitle")}</p>
        </div>
        <Link
          href="/probleme?tab=ctf"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("backToCtf")}
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded" />
          ))}
        </div>
      )}

      {!isLoading && (data?.entries.length ?? 0) === 0 && (
        <p className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t("scoreboardEmpty")}
        </p>
      )}

      <div className="space-y-1.5">
        {data?.entries.map((entry) => (
          <div
            key={entry.user_id}
            className="flex items-center gap-3 rounded border border-border px-3 py-2.5"
          >
            <span
              className={cn(
                "w-6 shrink-0 text-center font-mono text-sm font-semibold",
                entry.rank === 1 && "text-warning",
                entry.rank === 2 && "text-muted-foreground",
                entry.rank === 3 && "text-orange-600 dark:text-orange-400",
              )}
            >
              {entry.rank}
            </span>
            <Avatar className="h-7 w-7">
              {entry.avatar_url && <AvatarImage src={entry.avatar_url} alt={entry.username} />}
              <AvatarFallback>{entry.display_name.slice(0, 1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <Link
              href={`/u/${entry.username}` as Parameters<typeof Link>[0]["href"]}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:text-primary"
            >
              {entry.display_name}
            </Link>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {entry.solve_count} {t("solves")}
            </span>
            <span className="hidden font-mono text-xs text-muted-foreground md:block">
              {new Date(entry.last_solved_at).toLocaleDateString(locale)}
            </span>
            <span className="w-20 shrink-0 text-right font-mono text-sm font-semibold">
              {entry.total_points} {t("points")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
