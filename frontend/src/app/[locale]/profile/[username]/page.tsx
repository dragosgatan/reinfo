import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils";
import { CalendarDays, Swords } from "lucide-react";
import { ChallengeButton } from "@/components/duel/challenge-button";
import { RatingSparkline } from "@/components/duel/rating-sparkline";
import type { DuelRatingHistoryEntry } from "@/lib/types";

interface Props {
  params: Promise<{ username: string; locale: string }>;
}

interface UserProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  created_at: string;
  last_active_at: string;
  duel_rating: number;
  duel_wins: number;
  duel_losses: number;
  duel_draws: number;
}

interface SubmissionSummary {
  id: string;
  problem_slug: string;
  problem_title: string;
  verdict: string;
  score: number;
  created_at: string;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: username };
}

async function fetchUserProfile(username: string): Promise<UserProfile | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${apiUrl}/api/auth/users/${username}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfile;
  } catch {
    return null;
  }
}

async function fetchUserSubmissions(username: string): Promise<SubmissionSummary[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(
      `${apiUrl}/api/users/${username}/submissions?per_page=20`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { items: SubmissionSummary[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchRatingHistory(username: string): Promise<DuelRatingHistoryEntry[]> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(
      `${apiUrl}/api/duels/users/${username}/rating-history`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return [];
    return (await res.json()) as DuelRatingHistoryEntry[];
  } catch {
    return [];
  }
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const t = await getTranslations("profile");

  const [profile, submissions, ratingHistory] = await Promise.all([
    fetchUserProfile(username),
    fetchUserSubmissions(username),
    fetchRatingHistory(username),
  ]);

  const initials = username.slice(0, 2).toUpperCase();
  const joinedAt = profile?.created_at ?? new Date(2024, 8, 1).toISOString();
  const duelRating = profile?.duel_rating ?? 1200;
  const duelWins = profile?.duel_wins ?? 0;
  const duelLosses = profile?.duel_losses ?? 0;
  const duelDraws = profile?.duel_draws ?? 0;
  const totalDuels = duelWins + duelLosses + duelDraws;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-start">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className="font-mono text-sm">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">{username}</h1>
            {profile?.role === "admin" && (
              <Badge variant="secondary" className="text-xs">Admin</Badge>
            )}
            {profile?.role === "teacher" && (
              <Badge variant="outline" className="text-xs">Profesor</Badge>
            )}
            <ChallengeButton targetUsername={username} />
          </div>

          {profile?.bio && (
            <p className="mt-1.5 text-sm text-muted-foreground">{profile.bio}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("joinedAt")} {formatDate(joinedAt)}
            </span>
          </div>
        </div>

        {/* Duel stats card */}
        <div className="shrink-0 rounded border border-border bg-muted/20 p-3 min-w-[180px]">
          <div className="flex items-center gap-1.5 mb-2">
            <Swords className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Duel Rating
            </span>
          </div>
          <div className="flex items-end gap-3">
            <span className="font-mono text-2xl font-bold">{duelRating}</span>
            <RatingSparkline
              history={ratingHistory}
              currentRating={duelRating}
              className="mb-0.5"
            />
          </div>
          {totalDuels > 0 && (
            <div className="mt-2 flex gap-3 text-xs text-muted-foreground font-mono">
              <span className="text-success">{duelWins}V</span>
              <span className="text-destructive">{duelLosses}Î</span>
              <span className="text-warning">{duelDraws}R</span>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">{t("submissions")}</TabsTrigger>
          <TabsTrigger value="solved">{t("solvedProblems")}</TabsTrigger>
        </TabsList>

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

        <TabsContent value="solved" className="mt-4">
          <p className="text-sm text-muted-foreground">{t("solvedProblems")}: —</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
