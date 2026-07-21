"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, Droplet, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { CTF_CATEGORIES, CtfChallengeListResponseSchema } from "@/lib/types";
import type { CtfCategory, CtfChallengeSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

const DIFF_ANY = "any";

export function CtfTabContent() {
  const t = useTranslations("ctf");
  const router = useRouter();
  const params = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const canAuthor = user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";
  const [, startTransition] = useTransition();

  const category = params.get("ctf_category") ?? "";
  const diffMin = params.get("ctf_diff_min") ?? "";
  const diffMax = params.get("ctf_diff_max") ?? "";
  const solved = params.get("ctf_solved") ?? "";

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (diffMin) query.set("difficulty_min", diffMin);
  if (diffMax) query.set("difficulty_max", diffMax);
  if (solved && isAuthenticated) query.set("solved", solved === "solved" ? "true" : "false");
  query.set("per_page", "50");

  const { data, isLoading } = useQuery({
    queryKey: ["ctf-challenges", category, diffMin, diffMax, solved],
    queryFn: () => api.get(`/api/ctf?${query.toString()}`, CtfChallengeListResponseSchema),
    staleTime: 30 * 1000,
  });

  const grouped = new Map<CtfCategory, CtfChallengeSummary[]>();
  for (const item of data?.items ?? []) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const DIFFICULTY_OPTIONS = [
    { value: DIFF_ANY, label: t("difficultyAny") },
    ...Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("categoryLabel")}>
          <button
            onClick={() => setParam("ctf_category", null)}
            aria-pressed={category === ""}
            className={cn(
              "rounded border px-2 py-1 text-xs transition-colors",
              category === ""
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            {t("categoryAll")}
          </button>
          {CTF_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setParam("ctf_category", cat)}
              aria-pressed={category === cat}
              className={cn(
                "rounded border px-2 py-1 text-xs transition-colors",
                category === cat
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {t(`category.${cat}`)}
            </button>
          ))}
        </div>

        <select
          value={diffMin || DIFF_ANY}
          onChange={(e) => setParam("ctf_diff_min", e.target.value === DIFF_ANY ? "" : e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-xs"
          aria-label={t("difficultyMinLabel")}
        >
          {DIFFICULTY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t("difficultyMinLabel")} {opt.label}
            </option>
          ))}
        </select>
        <select
          value={diffMax || DIFF_ANY}
          onChange={(e) => setParam("ctf_diff_max", e.target.value === DIFF_ANY ? "" : e.target.value)}
          className="h-8 rounded border border-border bg-background px-2 text-xs"
          aria-label={t("difficultyMaxLabel")}
        >
          {DIFFICULTY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t("difficultyMaxLabel")} {opt.label}
            </option>
          ))}
        </select>

        {isAuthenticated && (
          <div className="flex gap-1.5" role="group" aria-label={t("solvedLabel")}>
            {[
              { value: "", label: t("solvedAll") },
              { value: "solved", label: t("solvedYes") },
              { value: "unsolved", label: t("solvedNo") },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setParam("ctf_solved", opt.value)}
                aria-pressed={solved === opt.value}
                className={cn(
                  "rounded border px-2 py-1 text-xs transition-colors",
                  solved === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        <Link
          href={"/ctf/scoreboard" as Parameters<typeof Link>[0]["href"]}
          className={cn(
            "flex items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground",
            !canAuthor && "ml-auto",
          )}
        >
          <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          {t("scoreboardLink")}
        </Link>

        {canAuthor && (
          <Button asChild size="sm" className="ml-auto gap-1.5">
            <Link href={"/ctf/nou" as Parameters<typeof Link>[0]["href"]}>
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              {t("addChallenge")}
            </Link>
          </Button>
        )}
      </div>

      {isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <p className="rounded border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          {t("noChallenges")}
        </p>
      )}

      <div className="space-y-8">
        {CTF_CATEGORIES.filter((cat) => grouped.has(cat)).map((cat) => (
          <div key={cat}>
            <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(`category.${cat}`)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grouped.get(cat)!.map((challenge) => (
                <CtfChallengeCard key={challenge.id} challenge={challenge} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CtfChallengeCard({ challenge }: { challenge: CtfChallengeSummary }) {
  const t = useTranslations("ctf");
  return (
    <Link
      href={`/ctf/${challenge.slug}` as Parameters<typeof Link>[0]["href"]}
      className="flex flex-col gap-2 rounded border border-border p-3.5 transition-colors hover:border-foreground/30"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-medium">{challenge.title}</span>
        {challenge.solved_by_user && (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-label={t("solvedYes")} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="font-mono">{challenge.difficulty}/10</span>
        <span className="font-mono font-semibold text-foreground">
          {challenge.current_points} {t("points")}
        </span>
        <span>
          {challenge.solve_count} {t("solves")}
        </span>
        {challenge.first_blood_username && (
          <span className="flex items-center gap-1 text-destructive">
            <Droplet className="h-3 w-3" aria-hidden="true" />
            {challenge.first_blood_username}
          </span>
        )}
      </div>
    </Link>
  );
}
