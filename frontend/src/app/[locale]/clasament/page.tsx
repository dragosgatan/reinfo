import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { resolveMediaUrl } from "@/lib/utils";
import type { DuelLeaderboardEntry, ProblemsLeaderboardEntry } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchProblemsLeaderboard(): Promise<ProblemsLeaderboardEntry[]> {
  try {
    const res = await fetch(`${API}/api/users/leaderboard/problems?limit=100`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ProblemsLeaderboardEntry[];
  } catch {
    return [];
  }
}

async function fetchProblemsLeaderboardWeekly(): Promise<ProblemsLeaderboardEntry[]> {
  try {
    const res = await fetch(`${API}/api/users/leaderboard/problems/weekly?limit=100`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ProblemsLeaderboardEntry[];
  } catch {
    return [];
  }
}

async function fetchDuelsLeaderboard(): Promise<DuelLeaderboardEntry[]> {
  try {
    const res = await fetch(`${API}/api/users/leaderboard/duels?limit=100`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as DuelLeaderboardEntry[];
  } catch {
    return [];
  }
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Clasament — ReInfo" };
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex h-6 w-6 items-center justify-center rounded font-mono text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-500">
        3
      </span>
    );
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center font-mono text-xs text-muted-foreground">
      {rank}
    </span>
  );
}

function UserCell({
  username,
  displayName,
  avatarUrl,
}: {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const initials = username.slice(0, 2).toUpperCase();
  return (
    <Link
      href={`/u/${username}`}
      className="flex items-center gap-2 group"
    >
      <Avatar className="h-6 w-6 rounded shrink-0">
        {avatarUrl && (
          <AvatarImage src={resolveMediaUrl(avatarUrl)} alt={username} className="rounded" />
        )}
        <AvatarFallback className="rounded text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="font-medium text-sm group-hover:text-primary transition-colors">
        {username}
      </span>
      {displayName !== username && (
        <span className="text-xs text-muted-foreground hidden sm:inline truncate max-w-[120px]">
          {displayName}
        </span>
      )}
    </Link>
  );
}

export default async function LeaderboardPage() {
  const t = await getTranslations("leaderboard");
  const [problems, weekly, duels] = await Promise.all([
    fetchProblemsLeaderboard(),
    fetchProblemsLeaderboardWeekly(),
    fetchDuelsLeaderboard(),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Tabs defaultValue="problems">
        <TabsList>
          <TabsTrigger value="problems">{t("tabProblems")}</TabsTrigger>
          <TabsTrigger value="weekly">{t("tabWeekly")}</TabsTrigger>
          <TabsTrigger value="duels">{t("tabDuels")}</TabsTrigger>
        </TabsList>

        <TabsContent value="problems" className="mt-4">
          <ProblemsTable entries={problems} noEntriesLabel={t("noEntries")} rankLabel={t("rank")} userLabel={t("user")} scoreLabel={t("score")} />
        </TabsContent>

        <TabsContent value="weekly" className="mt-4">
          <ProblemsTable entries={weekly} noEntriesLabel={t("noEntries")} rankLabel={t("rank")} userLabel={t("user")} scoreLabel={t("score")} />
          <p className="mt-3 text-[11px] text-muted-foreground">{t("weeklyNote")}</p>
        </TabsContent>

        <TabsContent value="duels" className="mt-4">
          {duels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">{t("noEntries")}</p>
          ) : (
            <div className="rounded border border-border overflow-hidden">
              <div className="hidden sm:grid grid-cols-[40px_1fr_90px_48px_48px_48px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <span>{t("rank")}</span>
                <span>{t("user")}</span>
                <span className="text-right">{t("rating")}</span>
                <span className="text-right text-emerald-600 dark:text-emerald-500">{t("wins")}</span>
                <span className="text-right text-muted-foreground">{t("draws")}</span>
                <span className="text-right text-red-600 dark:text-red-500">{t("losses")}</span>
              </div>
              <div className="divide-y divide-border">
                {duels.map((entry) => (
                  <div
                    key={entry.username}
                    className="grid grid-cols-[40px_1fr_90px] sm:grid-cols-[40px_1fr_90px_48px_48px_48px] gap-3 items-center px-4 py-2.5 transition-colors hover:bg-muted/20"
                  >
                    <RankBadge rank={entry.rank} />
                    <UserCell
                      username={entry.username}
                      displayName={entry.display_name}
                      avatarUrl={entry.avatar_url}
                    />
                    <div className="flex items-center justify-end gap-1">
                      <span className="font-mono text-sm font-semibold tabular-nums">
                        {entry.duel_rating}
                      </span>
                      <RatingBadge rating={entry.duel_rating} />
                    </div>
                    <span className="hidden sm:block font-mono text-xs text-right tabular-nums text-emerald-600 dark:text-emerald-500">
                      {entry.duel_wins}
                    </span>
                    <span className="hidden sm:block font-mono text-xs text-right tabular-nums text-muted-foreground">
                      {entry.duel_draws}
                    </span>
                    <span className="hidden sm:block font-mono text-xs text-right tabular-nums text-red-600 dark:text-red-500">
                      {entry.duel_losses}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProblemsTable({
  entries,
  noEntriesLabel,
  rankLabel,
  userLabel,
  scoreLabel,
}: {
  entries: ProblemsLeaderboardEntry[];
  noEntriesLabel: string;
  rankLabel: string;
  userLabel: string;
  scoreLabel: string;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground py-8 text-center">{noEntriesLabel}</p>;
  }
  return (
    <TooltipProvider>
      <div className="rounded border border-border overflow-hidden">
        <div className="hidden sm:grid grid-cols-[40px_1fr_80px_48px_48px_48px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{rankLabel}</span>
          <span>{userLabel}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-right cursor-default select-none">{scoreLabel}</span>
            </TooltipTrigger>
            <TooltipContent side="top">
              Ușor × 1 + Mediu × 2 + Greu × 3
            </TooltipContent>
          </Tooltip>
          <span className="text-right text-emerald-600 dark:text-emerald-500">E</span>
          <span className="text-right text-amber-600 dark:text-amber-500">M</span>
          <span className="text-right text-red-600 dark:text-red-500">G</span>
        </div>
        <div className="divide-y divide-border">
          {entries.map((entry) => (
            <div
              key={entry.username}
              className="grid grid-cols-[40px_1fr_80px] sm:grid-cols-[40px_1fr_80px_48px_48px_48px] gap-3 items-center px-4 py-2.5 transition-colors hover:bg-muted/20"
            >
              <RankBadge rank={entry.rank} />
              <UserCell
                username={entry.username}
                displayName={entry.display_name}
                avatarUrl={entry.avatar_url}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-sm font-semibold text-right tabular-nums cursor-default">
                    {entry.problem_score}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">pt</span>
                  </span>
                </TooltipTrigger>
                <TooltipContent side="left" className="font-mono">
                  {entry.solved_easy}×1 + {entry.solved_medium}×2 + {entry.solved_hard}×3
                </TooltipContent>
              </Tooltip>
              <span className="hidden sm:block font-mono text-xs text-right tabular-nums text-emerald-600 dark:text-emerald-500">
                {entry.solved_easy}
              </span>
              <span className="hidden sm:block font-mono text-xs text-right tabular-nums text-amber-600 dark:text-amber-500">
                {entry.solved_medium}
              </span>
              <span className="hidden sm:block font-mono text-xs text-right tabular-nums text-red-600 dark:text-red-500">
                {entry.solved_hard}
              </span>
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function RatingBadge({ rating }: { rating: number }) {
  if (rating >= 1800)
    return <Badge className="text-[9px] px-1 py-0 h-4 bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400 border-0">GM</Badge>;
  if (rating >= 1500)
    return <Badge className="text-[9px] px-1 py-0 h-4 bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400 border-0">M</Badge>;
  if (rating >= 1200)
    return <Badge className="text-[9px] px-1 py-0 h-4 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 border-0">E</Badge>;
  if (rating >= 1000)
    return <Badge className="text-[9px] px-1 py-0 h-4 bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 border-0">C</Badge>;
  return null;
}
