"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/navigation";
import { VerdictBadge } from "@/components/problems/verdict-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SubmissionListResponseSchema, SUPPORTED_LANGUAGES, LANGUAGE_LABELS } from "@/lib/types";
import type { VerdictType } from "@/lib/types";
import { cn } from "@/lib/utils";

const VERDICTS: VerdictType[] = ["AC", "WA", "CE", "RE", "TLE", "MLE", "PARTIAL"];

interface Filters {
  problem_slug: string;
  verdict: string;
  language: string;
  date_from: string;
  date_to: string;
}

const EMPTY_FILTERS: Filters = {
  problem_slug: "",
  verdict: "",
  language: "",
  date_from: "",
  date_to: "",
};

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams();
  params.set("page", String(page));
  params.set("per_page", "20");
  if (filters.problem_slug) params.set("problem_slug", filters.problem_slug);
  if (filters.verdict) params.set("verdict", filters.verdict);
  if (filters.language) params.set("language", filters.language);
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  return `/api/submissions?${params.toString()}`;
}

export function SubmisiiClient() {
  const t = useTranslations("submissions");
  const { isAuthenticated } = useAuth();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["submissions-list", appliedFilters, page],
    queryFn: () => api.get(buildQuery(appliedFilters, page), SubmissionListResponseSchema),
    enabled: isAuthenticated,
    staleTime: 15 * 1000,
  });

  const applyFilters = useCallback(() => {
    setAppliedFilters(filters);
    setPage(1);
  }, [filters]);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  }, []);

  const hasActiveFilters = Object.values(appliedFilters).some(Boolean);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-primary hover:underline">
            {t("loginAction")}
          </Link>{" "}
          {t("loginRequired")}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <h1 className="mb-5 text-xl font-bold tracking-tight">{t("title")}</h1>

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
        <Input
          placeholder={t("problem")}
          value={filters.problem_slug}
          onChange={(e) => setFilters((f) => ({ ...f, problem_slug: e.target.value }))}
          className="h-8 text-sm lg:w-40"
          onKeyDown={(e) => e.key === "Enter" && applyFilters()}
        />

        <Select
          value={filters.verdict || "_all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, verdict: v === "_all" ? "" : v }))}
        >
          <SelectTrigger className="h-8 text-sm lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t("allVerdicts")}</SelectItem>
            {VERDICTS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.language || "_all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, language: v === "_all" ? "" : v }))}
        >
          <SelectTrigger className="h-8 text-sm lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t("allLanguages")}</SelectItem>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
          className="h-8 text-sm lg:w-36"
          title={t("dateFrom")}
        />
        <Input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
          className="h-8 text-sm lg:w-36"
          title={t("dateTo")}
        />

        <div className="flex gap-2">
          <Button size="sm" onClick={applyFilters} className="h-8">
            {t("filter")}
          </Button>
          {hasActiveFilters && (
            <Button size="sm" variant="outline" onClick={clearFilters} className="h-8">
              {t("clearFilters")}
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-1">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded" />
          ))}
        </div>
      ) : !data || data.items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">{t("noSubmissions")}</p>
      ) : (
        <>
          <div className="rounded border border-border">
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-4 border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>{t("verdict")}</span>
              <span>{t("problem")}</span>
              <span className="text-right">{t("score")}</span>
              <span className="hidden sm:block">{t("language")}</span>
              <span className="text-right">{t("date")}</span>
            </div>
            {data.items.map((sub) => (
              <Link
                key={sub.id}
                href={`/submisii/${sub.id}` as Parameters<typeof Link>[0]["href"]}
                className={cn(
                  "grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-x-4 border-b border-border px-3 py-2.5 text-sm transition-colors last:border-0 hover:bg-muted/40",
                )}
              >
                <VerdictBadge verdict={sub.verdict} />
                <div className="min-w-0">
                  <span className="block truncate font-medium">{sub.problem_title}</span>
                  <span className="block truncate font-mono text-xs text-muted-foreground">
                    {sub.problem_slug}
                  </span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">{sub.score}p</span>
                <span className="hidden font-mono text-xs text-muted-foreground sm:block">
                  {LANGUAGE_LABELS[sub.language] ?? sub.language}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {new Date(sub.created_at).toLocaleDateString("ro")}
                </span>
              </Link>
            ))}
          </div>

          {data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ←
              </Button>
              <span className="text-xs">
                {page} / {data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.pages}
                onClick={() => setPage((p) => p + 1)}
              >
                →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
