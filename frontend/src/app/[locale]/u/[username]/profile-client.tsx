"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils";
import type { ActivityDay, ExternalResultRead, UserStatsRead } from "@/lib/types";
import { toast } from "sonner";
import {
  Award,
  BadgeCheck,
  CheckCircle2,
  Crown,
  Flame,
  Globe,
  Plus,
  Send,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Swords,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FriendsList } from "@/components/social/friends-list";
import { FriendRequestsPanel } from "@/components/social/friend-requests-panel";
import { cn } from "@/lib/utils";

type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "diamond";

interface AchievementMeta {
  key: string;
  label: string;
  description: string;
  tier: AchievementTier;
  Icon: LucideIcon;
}

const TIER_STYLES: Record<AchievementTier, { card: string; icon: string; badge: string }> = {
  bronze: {
    card: "border-amber-200 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
    icon: "text-amber-600 dark:text-amber-500",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
  },
  silver: {
    card: "border-zinc-300 bg-zinc-50/60 dark:border-zinc-700/60 dark:bg-zinc-900/30",
    icon: "text-zinc-500 dark:text-zinc-400",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
  },
  gold: {
    card: "border-yellow-300 bg-yellow-50/60 dark:border-yellow-800/50 dark:bg-yellow-950/20",
    icon: "text-yellow-600 dark:text-yellow-500",
    badge: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  },
  platinum: {
    card: "border-sky-300 bg-sky-50/60 dark:border-sky-800/50 dark:bg-sky-950/20",
    icon: "text-sky-600 dark:text-sky-400",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  },
  diamond: {
    card: "border-violet-300 bg-violet-50/60 dark:border-violet-800/50 dark:bg-violet-950/20",
    icon: "text-violet-600 dark:text-violet-400",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  },
};

const TIER_LABELS: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
  diamond: "Diamond",
};

const ALL_ACHIEVEMENTS: AchievementMeta[] = [
  { key: "first_submission", label: "Primul pas", description: "Ai trimis prima submisie pe platformă", tier: "bronze", Icon: Send },
  { key: "first_ac", label: "Deblocat", description: "Ai rezolvat prima problemă", tier: "bronze", Icon: CheckCircle2 },
  { key: "first_duel", label: "Intrat în arenă", description: "Ai participat la primul duel", tier: "bronze", Icon: Swords },
  { key: "first_external", label: "Dincolo de platformă", description: "Ai adăugat un rezultat dintr-o competiție externă", tier: "bronze", Icon: Globe },
  { key: "10_ac", label: "Constant", description: "Ai rezolvat 10 probleme distincte", tier: "silver", Icon: TrendingUp },
  { key: "first_hard", label: "Apetit pentru dificultate", description: "Ai rezolvat o problemă cu dificultate ridicată (7+)", tier: "silver", Icon: Zap },
  { key: "first_duel_win", label: "Prima sânge", description: "Ai câștigat primul duel", tier: "silver", Icon: Trophy },
  { key: "rating_1000", label: "Calificat", description: "Rating duel ≥ 1000", tier: "silver", Icon: Star },
  { key: "25_ac", label: "Rezolvitor", description: "Ai rezolvat 25 de probleme distincte", tier: "gold", Icon: Target },
  { key: "50_ac", label: "Dedicat", description: "Ai rezolvat 50 de probleme distincte", tier: "gold", Icon: Flame },
  { key: "10_duel_wins", label: "Duelant", description: "Ai câștigat 10 dueluri", tier: "gold", Icon: Shield },
  { key: "rating_1200", label: "Expert", description: "Rating duel ≥ 1200", tier: "gold", Icon: Star },
  { key: "verified_external", label: "Legitimat", description: "Un rezultat extern a fost verificat de admin", tier: "gold", Icon: BadgeCheck },
  { key: "10_hard", label: "Distrugător", description: "Ai rezolvat 10 probleme cu dificultate ridicată (7+)", tier: "gold", Icon: Zap },
  { key: "100_ac", label: "Centurion", description: "Ai rezolvat 100 de probleme distincte", tier: "platinum", Icon: Award },
  { key: "50_duel_wins", label: "Gladiator", description: "Ai câștigat 50 de dueluri", tier: "platinum", Icon: ShieldCheck },
  { key: "rating_1500", label: "Master", description: "Rating duel ≥ 1500", tier: "platinum", Icon: Crown },
  { key: "250_ac", label: "Maratonist", description: "Ai rezolvat 250 de probleme distincte", tier: "diamond", Icon: Sparkles },
  { key: "rating_1800", label: "Grandmaster", description: "Rating duel ≥ 1800", tier: "diamond", Icon: Sparkles },
];

interface ActivityHeatmapProps {
  days: ActivityDay[];
}

export function ActivityHeatmap({ days }: ActivityHeatmapProps) {
  const t = useTranslations("profile");

  const dayMap = new Map(days.map((d) => [d.date, d.count]));
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);
  const current = new Date(startDate);
  // align to Monday
  const dayOfWeek = startDate.getDay();
  const offset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  startDate.setDate(startDate.getDate() - offset);

  const weeks: { date: Date; iso: string; count: number }[][] = [];

  while (current <= today) {
    const week: { date: Date; iso: string; count: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const iso = current.toISOString().slice(0, 10);
      const count = dayMap.get(iso) ?? 0;
      week.push({ date: new Date(current), iso, count });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  function intensity(count: number): string {
    if (count === 0) return "bg-muted/40";
    const ratio = count / maxCount;
    if (ratio < 0.25) return "bg-emerald-200 dark:bg-emerald-900";
    if (ratio < 0.5) return "bg-emerald-400 dark:bg-emerald-700";
    if (ratio < 0.75) return "bg-emerald-600 dark:bg-emerald-500";
    return "bg-emerald-800 dark:bg-emerald-400";
  }

  const months: { label: string; col: number }[] = [];
  weeks.forEach((week, i) => {
    const first = week[0];
    if (first.date.getDate() <= 7) {
      months.push({
        label: first.date.toLocaleString("ro-RO", { month: "short" }),
        col: i,
      });
    }
  });

  if (days.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noActivity")}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <div style={{ position: "relative" }}>
        <div className="mb-1 flex gap-[3px] pl-0" style={{ paddingLeft: 0 }}>
          {weeks.map((_, i) => {
            const month = months.find((m) => m.col === i);
            return (
              <div key={i} style={{ width: 11, minWidth: 11 }} className="text-center">
                {month && (
                  <span className="text-[9px] text-muted-foreground leading-none">{month.label}</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-[3px]">
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((day) => (
                <div
                  key={day.iso}
                  title={`${day.iso}: ${day.count}`}
                  className={`h-[11px] w-[11px] rounded-[2px] ${intensity(day.count)}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DifficultyChartProps {
  stats: UserStatsRead;
}

export function DifficultyChart({ stats }: DifficultyChartProps) {
  const t = useTranslations("profile");
  const dist = stats.difficulty_distribution;
  const total = dist.easy + dist.medium + dist.hard;

  const bars = [
    { key: "easy", label: t("easy"), count: dist.easy, color: "bg-emerald-500" },
    { key: "medium", label: t("medium"), count: dist.medium, color: "bg-amber-500" },
    { key: "hard", label: t("hard"), count: dist.hard, color: "bg-red-500" },
  ];

  return (
    <div className="space-y-3">
      {bars.map(({ key, label, count, color }) => {
        const pct = total > 0 ? (count / total) * 100 : 0;
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-16 text-right text-sm text-muted-foreground tabular-nums shrink-0">
              {label}
            </span>
            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${color}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-sm tabular-nums shrink-0">{count}</span>
          </div>
        );
      })}
      {total === 0 && (
        <p className="text-sm text-muted-foreground">{t("privacyHidden")}</p>
      )}
    </div>
  );
}

interface AchievementGridProps {
  earned: string[];
}

export function AchievementGrid({ earned }: AchievementGridProps) {
  const t = useTranslations("profile");
  const earnedSet = new Set(earned);
  const earnedAchievements = ALL_ACHIEVEMENTS.filter((a) => earnedSet.has(a.key));

  if (earnedAchievements.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noAchievements")}</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {earnedAchievements.map((a) => {
        const styles = TIER_STYLES[a.tier];
        return (
          <div
            key={a.key}
            className={cn("flex flex-col gap-2 rounded border p-3", styles.card)}
            title={a.description}
          >
            <div className="flex items-start justify-between gap-1">
              <a.Icon className={cn("h-4 w-4 shrink-0 mt-0.5", styles.icon)} />
              <span className={cn("rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider leading-none", styles.badge)}>
                {TIER_LABELS[a.tier]}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold leading-snug">{a.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{a.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface ExternalResultsProps {
  username: string;
  initialResults: ExternalResultRead[];
  isOwnProfile: boolean;
  isAdmin: boolean;
}

export function ExternalResults({
  username,
  initialResults,
  isOwnProfile,
  isAdmin,
}: ExternalResultsProps) {
  const t = useTranslations("profile");
  const [results, setResults] = useState(initialResults);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    contest_name: "",
    platform: "",
    result_text: "",
    year: new Date().getFullYear().toString(),
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd() {
    setSubmitting(true);
    try {
      const created = await api.post<ExternalResultRead>("/api/users/me/external-results", {
        contest_name: form.contest_name,
        platform: form.platform,
        result_text: form.result_text,
        year: parseInt(form.year, 10),
      });
      setResults((prev) => [created, ...prev]);
      setForm({ contest_name: "", platform: "", result_text: "", year: new Date().getFullYear().toString() });
      setShowForm(false);
    } catch {
      toast.error("A apărut o eroare. Încearcă din nou.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/users/me/external-results/${id}`);
      setResults((prev) => prev.filter((r) => r.id !== id));
    } catch {
      toast.error("A apărut o eroare. Încearcă din nou.");
    }
  }

  async function handleToggleVerify(username: string, id: string) {
    try {
      const updated = await api.patch<ExternalResultRead>(
        `/api/users/${username}/external-results/${id}/verify`,
        {},
      );
      setResults((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch {
      toast.error("A apărut o eroare. Încearcă din nou.");
    }
  }

  return (
    <div className="space-y-3">
      {isOwnProfile && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm((v) => !v)}
            className="gap-1.5 text-xs"
          >
            {showForm ? (
              <>
                <X className="h-3.5 w-3.5" /> {t("cancelAdd")}
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> {t("addExternalResult")}
              </>
            )}
          </Button>
        </div>
      )}

      {showForm && (
        <div className="rounded border border-border bg-muted/20 p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("contestName")}</Label>
              <Input
                value={form.contest_name}
                onChange={(e) => setForm((f) => ({ ...f, contest_name: e.target.value }))}
                placeholder="ONI 2025"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("platform")}</Label>
              <Input
                value={form.platform}
                onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value }))}
                placeholder="pbinfo, infoarena..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("resultText")}</Label>
              <Input
                value={form.result_text}
                onChange={(e) => setForm((f) => ({ ...f, result_text: e.target.value }))}
                placeholder="Locul 3, Mențiune..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("year")}</Label>
              <Input
                type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                min={2000}
                max={2100}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={
                submitting ||
                !form.contest_name.trim() ||
                !form.platform.trim() ||
                !form.result_text.trim()
              }
              className="text-xs"
            >
              {t("addResult")}
            </Button>
          </div>
        </div>
      )}

      {results.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">{t("noExternalResults")}</p>
      )}

      {results.length > 0 && (
        <div className="rounded border border-border divide-y divide-border overflow-hidden">
          {results.map((r) => (
            <div key={r.id} className="flex items-start gap-3 px-4 py-3 text-sm">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{r.contest_name}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{r.platform}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">{r.year}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="font-mono text-sm">{r.result_text}</span>
                  {r.verified ? (
                    <Badge variant="success" className="text-[10px] gap-0.5 px-1.5">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      {t("verified")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] px-1.5">
                      {t("autoDeclarat")}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {formatDate(r.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-muted-foreground"
                    onClick={() => handleToggleVerify(username, r.id)}
                  >
                    <Trophy className="h-3 w-3 mr-1" />
                    {r.verified ? t("unverifyResult") : t("verifyResult")}
                  </Button>
                )}
                {isOwnProfile && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(r.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ProfileTabsProps {
  username: string;
  stats: UserStatsRead;
  activity: ActivityDay[];
  externalResults: ExternalResultRead[];
  submissions: SubmissionSummaryItem[];
  isOwnProfile: boolean;
  isAdmin: boolean;
}

interface SubmissionSummaryItem {
  id: string;
  problem_slug: string;
  problem_title: string;
  verdict: string;
  score: number;
  created_at: string;
}

export function ProfileTabs({
  username,
  stats,
  activity,
  externalResults,
  submissions,
  isOwnProfile,
  isAdmin,
}: ProfileTabsProps) {
  const t = useTranslations("profile");

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("activity")}
        </h2>
        <ActivityHeatmap days={activity} />
      </section>

      <Tabs defaultValue="difficulty">
        <TabsList>
          <TabsTrigger value="difficulty">{t("difficulty")}</TabsTrigger>
          <TabsTrigger value="submissions">{t("submissions")}</TabsTrigger>
          <TabsTrigger value="achievements">{t("achievements")}</TabsTrigger>
          <TabsTrigger value="external">{t("externalResults")}</TabsTrigger>
          {isOwnProfile && <TabsTrigger value="friends">Prieteni</TabsTrigger>}
        </TabsList>

        <TabsContent value="difficulty" className="mt-4">
          <DifficultyChart stats={stats} />
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          {submissions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio submisie publică.</p>
          ) : (
            <div className="overflow-hidden rounded border border-border divide-y divide-border">
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-muted/30"
                >
                  <Link
                    href={`/probleme/${sub.problem_slug}`}
                    className="flex-1 transition-colors hover:text-primary"
                  >
                    {sub.problem_title}
                  </Link>
                  <Badge
                    variant={
                      sub.score === 100 ? "success" : sub.score >= 60 ? "warning" : "destructive"
                    }
                  >
                    {sub.verdict === "AC" ? "AC" : `${sub.score} pct`}
                  </Badge>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                    {formatDate(sub.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <AchievementGrid earned={stats.achievements} />
        </TabsContent>

        <TabsContent value="external" className="mt-4">
          <ExternalResults
            username={username}
            initialResults={externalResults}
            isOwnProfile={isOwnProfile}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {isOwnProfile && (
          <TabsContent value="friends" className="mt-4 space-y-6">
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Cereri primite
              </h3>
              <FriendRequestsPanel />
            </div>
            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Prietenii mei
              </h3>
              <FriendsList />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
