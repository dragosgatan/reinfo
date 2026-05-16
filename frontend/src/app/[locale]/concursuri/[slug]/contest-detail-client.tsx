"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trophy, Users, CheckCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ContestDetailSchema } from "@/lib/types";
import { ContestStatusBadge } from "@/components/contests/contest-status-badge";
import { CountdownTimer } from "@/components/contests/countdown-timer";

const ORDINAL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

interface Props {
  slug: string;
}

export default function ContestDetailClient({ slug }: Props) {
  const t = useTranslations("contests");
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: contest, isLoading } = useQuery({
    queryKey: ["contest", slug],
    queryFn: () => api.get(`/api/contests/${slug}`, ContestDetailSchema),
    refetchInterval: 30_000,
  });

  const registerMutation = useMutation({
    mutationFn: () => api.post(`/api/contests/${slug}/register`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contest", slug] });
      toast.success(t("registered"));
    },
    onError: (err) => {
      const detail = err instanceof ApiError ? err.detail : t("create.errorGeneric");
      toast.error(detail);
    },
  });

  if (isLoading || !contest) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 text-sm text-muted-foreground">
        Se încarcă...
      </div>
    );
  }

  const isUpcoming = contest.status === "upcoming";
  const isOngoing = contest.status === "ongoing";
  const isPast = contest.status === "past";
  const canEdit =
    user?.role === "admin" ||
    (user?.role === "teacher" && contest.created_by === user?.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-2">
        <Link
          href="/concursuri"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {t("backToContests")}
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {contest.title}
            </h1>
            <ContestStatusBadge status={contest.status} />
          </div>
          {isUpcoming && (
            <CountdownTimer
              targetDate={contest.start_time}
              label={t("startsIn")}
            />
          )}
          {isOngoing && (
            <CountdownTimer
              targetDate={contest.end_time}
              label={t("endsIn")}
            />
          )}
          {isPast && (
            <p className="text-sm text-muted-foreground">{t("ended")}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {(isOngoing || isPast) && (
            <Link href={`/concursuri/${slug}/clasament`}>
              <Button variant="outline" size="sm">
                <Trophy className="mr-2 h-4 w-4" />
                {t("leaderboard")}
              </Button>
            </Link>
          )}
          {canEdit && (
            <Link href={`/concursuri/${slug}/editeaza`}>
              <Button variant="outline" size="sm">
                {t("edit.title")}
              </Button>
            </Link>
          )}
          {!isAuthenticated && isUpcoming && (
            <Link href="/login">
              <Button size="sm">{t("loginAction")}</Button>
            </Link>
          )}
          {isAuthenticated && !isPast && (
            contest.is_registered ? (
              <Button size="sm" variant="secondary" disabled>
                <CheckCircle className="mr-2 h-4 w-4" />
                {t("registered")}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => registerMutation.mutate()}
                disabled={registerMutation.isPending}
              >
                {t("register")}
              </Button>
            )
          )}
        </div>
      </div>

      <div className="mb-6 flex gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Users className="h-4 w-4" />
          {contest.participant_count} {t("participants")}
        </span>
        <span>
          {new Date(contest.start_time).toLocaleString("ro-RO", {
            dateStyle: "medium",
            timeStyle: "short",
          })}{" "}
          →{" "}
          {new Date(contest.end_time).toLocaleString("ro-RO", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      {contest.description_md && (
        <p className="mb-6 text-sm text-muted-foreground whitespace-pre-wrap border-l-2 border-border pl-4">
          {contest.description_md}
        </p>
      )}

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("problemList")}
        </h2>
        {canEdit && (
          <Link href={`/probleme/nou?contest_slug=${slug}`}>
            <Button variant="outline" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Adaugă problemă
            </Button>
          </Link>
        )}
      </div>

      {isUpcoming && contest.problems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("hiddenBeforeStart")}</p>
      ) : contest.problems.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noContests")}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>{t("create.name")}</TableHead>
              <TableHead className="text-right">{t("participants")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contest.problems.map((cp) => (
              <TableRow key={cp.problem_slug}>
                <TableCell className="font-mono font-medium">
                  {ORDINAL_LABELS[cp.ordinal - 1] ?? cp.ordinal}
                </TableCell>
                <TableCell>
                  {isOngoing && contest.is_registered ? (
                    <Link
                      href={`/concursuri/${slug}/${cp.problem_slug}`}
                      className="font-medium hover:underline"
                    >
                      {cp.problem_title}
                    </Link>
                  ) : isPast ? (
                    <Link
                      href={`/probleme/${cp.problem_slug}`}
                      className="font-medium hover:underline"
                    >
                      {cp.problem_title}
                    </Link>
                  ) : (
                    <span className="font-medium">{cp.problem_title}</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {cp.score_total} pt
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
