"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { LeaderboardResponseSchema, ContestDetailSchema } from "@/lib/types";

const ORDINAL_LABELS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

interface Props {
  slug: string;
}

export default function LeaderboardClient({ slug }: Props) {
  const t = useTranslations("contests");

  const { data: contest } = useQuery({
    queryKey: ["contest", slug],
    queryFn: () => api.get(`/api/contests/${slug}`, ContestDetailSchema),
  });

  const { data: lb, isLoading } = useQuery({
    queryKey: ["leaderboard", slug],
    queryFn: () => api.get(`/api/contests/${slug}/leaderboard`, LeaderboardResponseSchema),
    refetchInterval: contest?.status === "ongoing" ? 10_000 : false,
  });

  const problemSlugs = contest?.problems.map((p) => p.problem_slug) ?? [];

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

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {t("leaderboard")}
      </h1>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă...</p>
      ) : !lb || lb.entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">{t("rank")}</TableHead>
                <TableHead>{t("participant")}</TableHead>
                {problemSlugs.map((ps, i) => (
                  <TableHead key={ps} className="text-center w-16">
                    {ORDINAL_LABELS[i] ?? String(i + 1)}
                  </TableHead>
                ))}
                <TableHead className="text-right">{t("total")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lb.entries.map((entry) => (
                <TableRow key={entry.user_id}>
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
                  {problemSlugs.map((ps) => (
                    <TableCell key={ps} className="text-center font-mono text-sm">
                      {entry.problem_scores[ps] != null
                        ? entry.problem_scores[ps]
                        : "—"}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-semibold">
                    {entry.total_score}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {contest?.status === "ongoing" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Clasament actualizat automat la fiecare 10 secunde.
        </p>
      )}
    </div>
  );
}
