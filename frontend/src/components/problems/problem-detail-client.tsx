"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Clock, MemoryStick, Copy, Check, AlertCircle, Pencil, Trophy } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyIndicator, getDifficultyLabel } from "./difficulty-indicator";
import { ProblemStatement } from "./problem-statement";
import { QuizPanel } from "./quiz-panel";
import { SubmissionPanel } from "./submission-panel";
import { VerdictBadge } from "./verdict-badge";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ProblemDetailSchema, SubmissionListResponseSchema } from "@/lib/types";
import { cn } from "@/lib/utils";

function StatementLangToggle({
  markdown,
  markdownEn,
  markdownHu,
}: {
  markdown: string;
  markdownEn: string;
  markdownHu?: string | null;
}) {
  const [lang, setLang] = useState<"ro" | "en" | "hu">("ro");
  const activeMarkdown =
    lang === "en" ? markdownEn : lang === "hu" && markdownHu ? markdownHu : markdown;
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded border border-border text-xs">
          <button
            type="button"
            onClick={() => setLang("ro")}
            className={cn(
              "px-2.5 py-1 transition-colors",
              lang === "ro" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            RO
          </button>
          <button
            type="button"
            onClick={() => setLang("en")}
            className={cn(
              "px-2.5 py-1 transition-colors",
              lang === "en" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
            )}
          >
            EN
          </button>
          {markdownHu && (
            <button
              type="button"
              onClick={() => setLang("hu")}
              className={cn(
                "px-2.5 py-1 transition-colors",
                lang === "hu" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              HU
            </button>
          )}
        </div>
      </div>
      <ProblemStatement markdown={activeMarkdown} />
    </div>
  );
}
import type { ProblemDetail, SubmissionSummary } from "@/lib/types";

interface ProblemDetailClientProps {
  slug: string;
}

export function ProblemDetailClient({ slug }: ProblemDetailClientProps) {
  const { user, isAuthenticated } = useAuth();
  const t = useTranslations("problems");

  const {
    data: problem,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["problem", slug],
    queryFn: () => api.get(`/api/problems/${slug}`, ProblemDetailSchema),
    retry: (count, err) => {
      if (err instanceof ApiError && err.status === 404) return false;
      return count < 2;
    },
    staleTime: 2 * 60 * 1000,
  });

  const isQuiz = problem?.problem_type === "quiz";

  const { data: submissionsData } = useQuery({
    queryKey: ["submissions", slug, user?.id],
    queryFn: () =>
      api.get(`/api/submissions?problem_slug=${slug}&per_page=20`, SubmissionListResponseSchema),
    enabled: isAuthenticated && !isQuiz,
    staleTime: 30 * 1000,
  });

  const bestScore =
    submissionsData?.items.reduce(
      (best, s) => (s.verdict === "AC" ? Math.max(best, s.score) : best),
      -1,
    ) ?? -1;

  if (isLoading) return <ProblemDetailSkeleton />;

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">
          {status === 404 ? t("notFoundError") : t("loadError")}
        </p>
        <Link
          href="/probleme"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          {t("backToProblems")}
        </Link>
      </div>
    );
  }

  if (!problem) return null;

  return (
    <ProblemDetailLayout
      problem={problem}
      submissions={submissionsData?.items ?? []}
      bestScore={bestScore >= 0 ? bestScore : null}
      isAuthenticated={isAuthenticated}
    />
  );
}

function ProblemDetailLayout({
  problem,
  submissions,
  bestScore,
  isAuthenticated,
}: {
  problem: ProblemDetail;
  submissions: SubmissionSummary[];
  bestScore: number | null;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("problems");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const canEdit =
    user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";
  const memoryMb = Math.round(problem.memory_limit_kb / 1024);
  const [editorFocused, setEditorFocused] = useState(false);
  const isQuiz = problem.problem_type === "quiz";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <Link
          href="/probleme"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("backToProblems")}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{problem.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <DifficultyIndicator difficulty={problem.difficulty} />
              <span className="text-xs text-muted-foreground">
                {getDifficultyLabel(problem.difficulty, t)} · {problem.difficulty}/10
              </span>
              {problem.tags.map((tag) => (
                <Badge key={tag} variant="muted" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {problem.origin_contest && (
              <Link
                href={`/concursuri/${problem.origin_contest.slug}` as Parameters<typeof Link>[0]["href"]}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Trophy className="h-3 w-3" />
                {problem.origin_contest.title}
              </Link>
            )}
            <span className="font-mono">{problem.score_total} pct</span>
            <span>{problem.solve_count} {t("solves")}</span>
            {canEdit && (
              <Link
                href={`/probleme/${problem.slug}/editeaza` as Parameters<typeof Link>[0]["href"]}
                className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
              >
                <Pencil className="h-3 w-3" aria-hidden="true" />
                {tCommon("edit")}
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className={cn(
        "grid gap-6",
        editorFocused
          ? "lg:grid-cols-[360px_1fr]"
          : "lg:grid-cols-[1fr_360px]",
      )}>
        <div className="min-w-0">
          <Tabs defaultValue="statement">
            <TabsList className="mb-4">
              <TabsTrigger value="statement">{t("enunt")}</TabsTrigger>
              {!isQuiz && (
                <TabsTrigger value="submissions">
                  {t("trimiteri")}{submissions.length > 0 && ` (${submissions.length})`}
                </TabsTrigger>
              )}
              <TabsTrigger value="discussion">{t("discutie")}</TabsTrigger>
            </TabsList>

            <TabsContent value="statement" className="mt-0">
              {(problem.statement_md_en || problem.statement_md_hu) ? (
                <StatementLangToggle
                  markdown={problem.statement_md}
                  markdownEn={problem.statement_md_en ?? ""}
                  markdownHu={problem.statement_md_hu}
                />
              ) : (
                <ProblemStatement markdown={problem.statement_md} />
              )}

              {(problem.input_format || problem.output_format) && (
                <>
                  <Separator className="my-5" />
                  <div className="grid gap-4 sm:grid-cols-2">
                    {problem.input_format && (
                      <div>
                        <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                          {t("inputFormat")}
                        </h3>
                        <ProblemStatement markdown={problem.input_format} />
                      </div>
                    )}
                    {problem.output_format && (
                      <div>
                        <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                          {t("outputFormat")}
                        </h3>
                        <ProblemStatement markdown={problem.output_format} />
                      </div>
                    )}
                  </div>
                </>
              )}

              {problem.sample_test_cases.length > 0 && (
                <>
                  <Separator className="my-5" />
                  <h3 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    {t("sampleTests")}
                  </h3>
                  <SampleTestCases slug={problem.slug} samples={problem.sample_test_cases} />
                </>
              )}

              {!isQuiz && (
                <>
                  <Separator className="my-5" />
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/30 dark:bg-amber-950/20">
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {t("ioNote")}
                    </p>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="submissions" className="mt-0">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    {t("loginAction")}
                  </Link>{" "}
                  {t("loginToSeeSubmissions")}
                </p>
              ) : submissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noSubmissions")}</p>
              ) : (
                <SubmissionsTable submissions={submissions} />
              )}
            </TabsContent>

            <TabsContent value="discussion" className="mt-0">
              <p className="text-sm text-muted-foreground">{t("discussionComingSoon")}</p>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <div className="rounded border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isQuiz ? t("quizAnswerTitle") : t("submitTitle")}
            </p>
            {isQuiz ? (
              <QuizPanel slug={problem.slug} options={problem.quiz_options} />
            ) : (
              <SubmissionPanel
                slug={problem.slug}
                scoreTotal={problem.score_total}
                bestScore={bestScore}
                isAuthenticated={isAuthenticated}
                editorFocused={editorFocused}
                onToggleEditorFocus={() => setEditorFocused((v) => !v)}
              />
            )}
          </div>

          {!isQuiz && (
            <div className="rounded border border-border p-4">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {t("restrictions")}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    {t("timeLimit")}
                  </span>
                  <span className="font-mono text-xs">
                    {problem.time_limit_ms >= 1000
                      ? `${problem.time_limit_ms / 1000}s`
                      : `${problem.time_limit_ms}ms`}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MemoryStick className="h-3.5 w-3.5" />
                    {t("memoryLimit")}
                  </span>
                  <span className="font-mono text-xs">{memoryMb} MB</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

interface SampleTestCasesProps {
  slug: string;
  samples: ProblemDetail["sample_test_cases"];
}

function SampleTestCases({ slug, samples }: SampleTestCasesProps) {
  const [fetchedInputs, setFetchedInputs] = useState<Record<number, string>>({});

  const fetchSample = useCallback(
    async (ordinal: number) => {
      if (fetchedInputs[ordinal] !== undefined) return;
      try {
        const res = await fetch(`/api/problems/${slug}/input/${ordinal}`, {
          credentials: "include",
        });
        if (res.ok) {
          const text = await res.text();
          setFetchedInputs((prev) => ({ ...prev, [ordinal]: text }));
        }
      } catch {
        // ignore
      }
    },
    [slug, fetchedInputs],
  );

  return (
    <div className="space-y-4">
      {samples.map((tc) => (
        <SampleTestCase
          key={tc.id}
          ordinal={tc.ordinal}
          onMount={() => fetchSample(tc.ordinal)}
          inputText={fetchedInputs[tc.ordinal]}
        />
      ))}
    </div>
  );
}

function SampleTestCase({
  ordinal,
  onMount,
  inputText,
}: {
  ordinal: number;
  onMount: () => void;
  inputText?: string;
}) {
  const t = useTranslations("problems");

  useEffect(() => {
    onMount();
  }, [onMount]);

  return (
    <div>
      <p className="mb-2 text-xs text-muted-foreground">
        {t("example")} {ordinal + 1}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {t("inputLabel")}
            </span>
            {inputText !== undefined && <CopyButton text={inputText} />}
          </div>
          <pre className="min-h-[60px] overflow-x-auto rounded border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
            {inputText ?? <Skeleton className="h-4 w-24" />}
          </pre>
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {t("outputLabel")}
            </span>
          </div>
          <pre className="min-h-[60px] overflow-x-auto rounded border border-border bg-muted px-3 py-2 font-mono text-xs leading-relaxed text-muted-foreground">
            {t("outputHidden")}
          </pre>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const t = useTranslations("problems");
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      aria-label={t("copyInput")}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? t("copied") : t("copyInput")}
    </button>
  );
}

function SubmissionsTable({ submissions }: { submissions: SubmissionSummary[] }) {
  const locale = useLocale();
  return (
    <div className="space-y-1">
      {submissions.map((sub) => (
        <Link
          key={sub.id}
          href={`/submisii/${sub.id}` as Parameters<typeof Link>[0]["href"]}
          className={cn(
            "flex items-center gap-3 rounded border border-border px-3 py-2 text-xs transition-colors hover:bg-muted/50",
          )}
        >
          <VerdictBadge verdict={sub.verdict} />
          <span className="font-mono text-muted-foreground">{sub.score}p</span>
          <span className="text-muted-foreground">{sub.language}</span>
          <span className="ml-auto font-mono text-muted-foreground">
            {new Date(sub.created_at).toLocaleDateString(locale)}
          </span>
        </Link>
      ))}
    </div>
  );
}

function ProblemDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-4 w-24" />
      <div className="mb-5 space-y-2">
        <Skeleton className="h-7 w-64" />
        <div className="flex gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-3/4" : "w-full")} />
          ))}
        </div>
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded" />
          <Skeleton className="h-64 w-full rounded" />
        </div>
      </div>
    </div>
  );
}
