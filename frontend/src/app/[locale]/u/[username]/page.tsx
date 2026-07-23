import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { cookies } from "next/headers";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { formatDate } from "@/lib/utils";
import { resolveMediaUrl } from "@/lib/utils";
import { CalendarDays, Github, Link as LinkIcon, Mail, Pencil, Swords, Trophy } from "lucide-react";
import { ChallengeButton } from "@/components/duel/challenge-button";
import { RatingSparkline } from "@/components/duel/rating-sparkline";
import { AddFriendButton } from "@/components/social/add-friend-button";
import { getRatingTier } from "@/lib/contest-rating";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProfileTabs } from "./profile-client";
import type {
  ActivityDay,
  ExternalResultRead,
  UserProfileRead,
  UserStatsRead,
} from "@/lib/types";
import type { ContestRatingHistoryEntry, DuelRatingHistoryEntry } from "@/lib/types";

interface Props {
  params: Promise<{ username: string; locale: string }>;
}

interface SubmissionSummary {
  id: string;
  problem_slug: string;
  problem_title: string;
  verdict: string;
  score: number;
  created_at: string;
}

interface CurrentUser {
  username: string;
  role: string;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchProfile(username: string): Promise<UserProfileRead | null> {
  try {
    const res = await fetch(`${API}/api/auth/users/${username}`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as UserProfileRead;
  } catch {
    return null;
  }
}

async function fetchStats(username: string): Promise<UserStatsRead | null> {
  try {
    const res = await fetch(`${API}/api/users/${username}/stats`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return null;
    return (await res.json()) as UserStatsRead;
  } catch {
    return null;
  }
}

async function fetchActivity(username: string): Promise<ActivityDay[]> {
  try {
    const res = await fetch(`${API}/api/users/${username}/activity`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ActivityDay[];
  } catch {
    return [];
  }
}

async function fetchExternalResults(username: string): Promise<ExternalResultRead[]> {
  try {
    const res = await fetch(`${API}/api/users/${username}/external-results`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ExternalResultRead[];
  } catch {
    return [];
  }
}

async function fetchSubmissions(username: string): Promise<SubmissionSummary[]> {
  try {
    const res = await fetch(`${API}/api/users/${username}/submissions?per_page=20`, {
      next: { revalidate: 30 },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items: SubmissionSummary[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

async function fetchRatingHistory(username: string): Promise<DuelRatingHistoryEntry[]> {
  try {
    const res = await fetch(`${API}/api/duels/users/${username}/rating-history`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as DuelRatingHistoryEntry[];
  } catch {
    return [];
  }
}

async function fetchContestRatingHistory(username: string): Promise<ContestRatingHistoryEntry[]> {
  try {
    const res = await fetch(`${API}/api/contests/users/${username}/rating-history`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ContestRatingHistoryEntry[];
  } catch {
    return [];
  }
}

async function fetchCurrentUser(cookieHeader: string): Promise<CurrentUser | null> {
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as CurrentUser;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `${username} - ReInfo` };
}

export default async function UserProfilePage({ params }: Props) {
  const { username } = await params;
  const t = await getTranslations("profile");

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();

  const [
    profile,
    stats,
    activity,
    externalResults,
    submissions,
    ratingHistory,
    contestRatingHistory,
    currentUser,
  ] = await Promise.all([
    fetchProfile(username),
    fetchStats(username),
    fetchActivity(username),
    fetchExternalResults(username),
    fetchSubmissions(username),
    fetchRatingHistory(username),
    fetchContestRatingHistory(username),
    fetchCurrentUser(cookieHeader),
  ]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Utilizatorul nu a fost găsit.</p>
      </div>
    );
  }

  const initials = username.slice(0, 2).toUpperCase();
  const duelRating = profile.duel_rating;
  const duelWins = profile.duel_wins;
  const duelLosses = profile.duel_losses;
  const duelDraws = profile.duel_draws;
  const totalDuels = duelWins + duelLosses + duelDraws;
  const contestRating = profile.contest_rating;
  const contestTier = getRatingTier(contestRating);

  const isOwnProfile = currentUser?.username === username;
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "superuser";

  const defaultStats: UserStatsRead = {
    total_solved: 0,
    total_submissions: 0,
    difficulty_distribution: { easy: 0, medium: 0, hard: 0 },
    achievements: [],
    problem_score: 0,
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-6 border-b border-border pb-8 sm:flex-row sm:items-start">
        <Avatar className="h-24 w-24 shrink-0 rounded-lg">
          {profile.avatar_url && (
            <AvatarImage
              src={resolveMediaUrl(profile.avatar_url)}
              alt={username}
              className="rounded-lg"
            />
          )}
          <AvatarFallback className="rounded-lg font-mono text-2xl">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{username}</h1>
            {profile.display_name !== username && (
              <span className="text-base text-muted-foreground">{profile.display_name}</span>
            )}
            {(profile.role === "admin" || profile.role === "superuser") && (
              <Badge variant="secondary" className="text-xs">
                Admin
              </Badge>
            )}
            {profile.role === "teacher" && (
              <Badge variant="outline" className="text-xs">
                Profesor
              </Badge>
            )}
          </div>

          {profile.bio ? (
            <MarkdownContent
              markdown={profile.bio}
              allowImages={false}
              className="mt-2 max-w-prose"
            />
          ) : (
            <p className="mt-2 text-sm italic text-muted-foreground">{t("noBio")}</p>
          )}

          {(profile.github_url || profile.link_1 || profile.link_2 || profile.link_3) && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              {profile.github_url && (
                <a
                  href={profile.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Github className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate max-w-[180px]">
                    {profile.github_url.replace(/^https?:\/\/(www\.)?github\.com\//, "")}
                  </span>
                </a>
              )}
              {([profile.link_1, profile.link_2, profile.link_3] as (string | null | undefined)[])
                .filter(Boolean)
                .map((link, i) => {
                  let label: string;
                  try {
                    label = new URL(link!).hostname.replace(/^www\./, "");
                  } catch {
                    label = link!;
                  }
                  return (
                    <a
                      key={i}
                      href={link!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <LinkIcon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate max-w-[180px]">{label}</span>
                    </a>
                  );
                })}
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("joinedAt")} {formatDate(profile.created_at)}
            </span>
            {profile.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {profile.email}
              </span>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <ChallengeButton targetUsername={username} />
            <AddFriendButton username={username} />
            {isOwnProfile && (
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/setari/profil">
                  <Pencil className="h-3.5 w-3.5" />
                  {t("editProfile")}
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div className="shrink-0 space-y-2 sm:text-right">
          <div className="rounded border border-border bg-muted/20 p-3 min-w-[200px]">
            <div className="flex items-center gap-1.5 mb-2">
              <Swords className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("duelRating")}
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

          <div className="rounded border border-border bg-muted/20 p-3 min-w-[200px]">
            <div className="flex items-center gap-1.5 mb-2">
              <Trophy className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("contestRating")}
              </span>
            </div>
            <div className="flex items-end gap-3">
              <span className="font-mono text-2xl font-bold">{contestRating}</span>
              <RatingSparkline
                history={contestRatingHistory}
                currentRating={contestRating}
                className="mb-0.5"
                emptyLabel={t("noRatedContests")}
              />
            </div>
            <p className={`mt-2 text-xs font-medium ${contestTier.colorClass}`}>
              {contestTier.title}
            </p>
          </div>

          {stats && (
            <div className="flex gap-2 justify-end flex-wrap">
              <div className="rounded border border-border bg-muted/20 px-3 py-2 text-center min-w-[80px]">
                <p className="font-mono text-lg font-bold">{stats.total_solved}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t("totalSolved")}
                </p>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="rounded border border-border bg-muted/20 px-3 py-2 text-center min-w-[80px] cursor-default">
                      <p className="font-mono text-lg font-bold">{stats.problem_score}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                        {t("problemScore")}
                      </p>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center leading-relaxed">
                    Ușor × 1 + Mediu × 2 + Greu × 3
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <div className="rounded border border-border bg-muted/20 px-3 py-2 text-center min-w-[80px]">
                <p className="font-mono text-lg font-bold">{stats.total_submissions}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {t("totalSubmissions")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ProfileTabs
        username={username}
        stats={stats ?? defaultStats}
        activity={activity}
        externalResults={externalResults}
        submissions={submissions}
        isOwnProfile={isOwnProfile}
        isAdmin={isAdmin}
      />
    </div>
  );
}
