"use client";

import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, Flag } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
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
import { api } from "@/lib/api";
import { ContestDetailSchema, ContestViolationSchema, SubmissionSummarySchema } from "@/lib/types";
import { z } from "zod";

interface Props {
  slug: string;
}

function FlagBadge({ reason, labels }: { reason: string; labels: Record<string, string> }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
      <Flag className="h-3 w-3" />
      {labels[reason] ?? reason}
    </span>
  );
}

function ViolationBadge({ type, labels }: { type: string; labels: Record<string, string> }) {
  const isEntry = type === "contest_entry";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium",
        isEntry
          ? "bg-muted text-muted-foreground"
          : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
      ].join(" ")}
    >
      <ShieldAlert className="h-3 w-3" />
      {labels[type] ?? type}
    </span>
  );
}

export default function MonitorizareClient({ slug }: Props) {
  const t = useTranslations("contests");
  const { user } = useAuth();
  const locale = useLocale();

  const FLAG_LABELS: Record<string, string> = {
    diacritics: t("flagDiacritics"),
    emoji: t("flagEmoji"),
    impossibly_fast: t("flagImpossiblyFast"),
  };

  const VIOLATION_LABELS: Record<string, string> = {
    fingerprint_mismatch: t("violationFingerprint"),
    contest_entry: t("violationContestEntry"),
    fullscreen_exit: t("violationFullscreenExit"),
    paste_attempt: t("violationPasteAttempt"),
  };

  const { data: contest } = useQuery({
    queryKey: ["contest", slug],
    queryFn: () => api.get(`/api/contests/${slug}`, ContestDetailSchema),
  });

  const canView =
    user?.role === "admin" || (user?.role === "teacher" && contest?.created_by === user?.id);

  const { data: flagged = [], isLoading: flaggedLoading } = useQuery({
    queryKey: ["contest-flagged", slug],
    queryFn: () =>
      api.get(`/api/contests/${slug}/flagged-submissions`, z.array(SubmissionSummarySchema)),
    enabled: canView,
    refetchInterval: 15_000,
  });

  const { data: violations = [], isLoading: violationsLoading } = useQuery({
    queryKey: ["contest-violations", slug],
    queryFn: () =>
      api.get(`/api/contests/${slug}/violations`, z.array(ContestViolationSchema)),
    enabled: canView,
    refetchInterval: 15_000,
  });

  if (!user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-muted-foreground">
        {t("loadingLeaderboard")}
      </div>
    );
  }

  if (contest && !canView) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-sm text-muted-foreground">
        {t("insufficientPermissions")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href={`/concursuri/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {contest?.title ?? slug}
        </Link>
      </div>

      <div className="mb-1 flex items-center gap-2">
        <ShieldAlert className="h-5 w-5" />
        <h1 className="text-xl font-semibold tracking-tight">{t("monitoring")}</h1>
      </div>
      <p className="mb-8 text-sm text-muted-foreground">
        {t("monitoringDesc")}
      </p>

      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("flaggedSubmissions")} ({flaggedLoading ? "…" : flagged.length})
        </h2>
        {flagged.length === 0 && !flaggedLoading ? (
          <p className="text-sm text-muted-foreground">{t("noFlaggedSubmissions")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnUser")}</TableHead>
                <TableHead>{t("columnProblem")}</TableHead>
                <TableHead>{t("columnReason")}</TableHead>
                <TableHead>{t("columnLanguage")}</TableHead>
                <TableHead>{t("columnTime")}</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagged.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-mono text-sm">{sub.user_id.slice(0, 8)}</TableCell>
                  <TableCell className="font-medium">{sub.problem_title}</TableCell>
                  <TableCell>
                    {sub.flag_reason && <FlagBadge reason={sub.flag_reason} labels={FLAG_LABELS} />}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{sub.language}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(sub.created_at).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/submisii/${sub.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {t("detailsLink")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t("browserEvents")} ({violationsLoading ? "…" : violations.length})
        </h2>
        {violations.length === 0 && !violationsLoading ? (
          <p className="text-sm text-muted-foreground">{t("noBrowserEvents")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnUser")}</TableHead>
                <TableHead>{t("columnType")}</TableHead>
                <TableHead>{t("columnDetails")}</TableHead>
                <TableHead>{t("columnTime")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {violations.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-mono text-sm">{v.user_id.slice(0, 8)}</TableCell>
                  <TableCell>
                    <ViolationBadge type={v.violation_type} labels={VIOLATION_LABELS} />
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                    {v.details ? JSON.stringify(v.details) : "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(v.created_at).toLocaleTimeString(locale, {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}