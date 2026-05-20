"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { Loader2, AlertCircle, Clock, MemoryStick, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { VerdictBadge } from "@/components/problems/verdict-badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import { SubmissionSchema, LANGUAGE_LABELS, MONACO_LANGUAGE_MAP } from "@/lib/types";
import type { Submission, SubmissionResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[400px] items-center justify-center rounded border border-border bg-muted">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface Props {
  id: string;
}

export function SubmissionDetailClient({ id }: Props) {
  const t = useTranslations("submissions");

  const { data, isLoading, error } = useQuery({
    queryKey: ["submission", id],
    queryFn: () => api.get(`/api/submissions/${id}`, SubmissionSchema),
    retry: (count, err) => {
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) return false;
      return count < 2;
    },
    staleTime: 60 * 1000,
  });

  if (isLoading) return <DetailSkeleton />;

  if (error) {
    const status = error instanceof ApiError ? error.status : 0;
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {status === 404
            ? t("notFound")
            : status === 403
              ? t("accessDenied")
              : "A apărut o eroare la încărcarea submisiei."}
        </p>
        <Link
          href="/submisii"
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          {t("backToSubmissions")}
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return <SubmissionDetail submission={data} />;
}

function SubmissionDetail({ submission }: { submission: Submission }) {
  const t = useTranslations("submissions");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const results = submission.results;
  const passedCount = results.filter((r) => r.verdict === "AC").length;
  const maxTimeMs =
    results.length > 0
      ? Math.max(...results.map((r) => r.execution_time_ms ?? 0))
      : null;
  const maxMemoryKb =
    results.length > 0
      ? Math.max(...results.map((r) => r.memory_kb ?? 0))
      : null;

  const isCE = submission.verdict === "CE";
  const ceMessage = isCE ? results.find((r) => r.message)?.message ?? null : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href="/submisii"
        className="mb-5 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("backToSubmissions")}
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <VerdictBadge verdict={submission.verdict} className="text-sm px-3 py-1" />
        <span className="font-mono text-sm font-semibold">{submission.score}p</span>
        <span className="rounded border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground">
          {LANGUAGE_LABELS[submission.language] ?? submission.language}
        </span>
        {submission.problem_slug && (
          <Link
            href={`/probleme/${submission.problem_slug}` as Parameters<typeof Link>[0]["href"]}
            className="rounded border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("problemLabel")}: {submission.problem_slug}
          </Link>
        )}
        <span className="ml-auto font-mono text-xs text-muted-foreground">
          {new Date(submission.created_at).toLocaleString("ro")}
        </span>
      </div>

      {submission.verdict === "pending" && (
        <div className="mb-5 flex items-center gap-2 rounded border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("pending")}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="font-medium">
              {t("testsPassed", { passed: passedCount, total: results.length })}
            </span>
            {maxTimeMs !== null && maxTimeMs > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {t("maxTime")}: {maxTimeMs} ms
              </span>
            )}
            {maxMemoryKb !== null && maxMemoryKb > 0 && (
              <span className="flex items-center gap-1">
                <MemoryStick className="h-3 w-3" />
                {t("maxMemory")}: {maxMemoryKb} KB
              </span>
            )}
          </div>

          <div className="mb-6 rounded border border-border">
            <div className="grid grid-cols-[2rem_5rem_3rem_4rem_4rem] gap-x-3 border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>#</span>
              <span>{t("verdict")}</span>
              <span className="text-right">{t("score")}</span>
              <span className="text-right">Timp</span>
              <span className="text-right">Mem.</span>
            </div>
            {results.map((r, i) => (
              <TestRow key={r.id} result={r} index={i} />
            ))}
          </div>

          {isCE && ceMessage && (
            <div className="mb-6">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {t("compileError")}
              </p>
              <pre className="overflow-x-auto rounded border border-destructive/20 bg-destructive/5 px-4 py-3 font-mono text-xs leading-relaxed text-destructive">
                {ceMessage}
              </pre>
            </div>
          )}
        </>
      )}

      <Separator className="mb-5" />

      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("sourceCode")}
      </p>
      <div className="overflow-hidden rounded border border-border">
        <MonacoEditor
          height="420px"
          language={MONACO_LANGUAGE_MAP[submission.language] ?? "plaintext"}
          value={submission.submitted_code}
          theme={mounted && resolvedTheme === "dark" ? "vs-dark" : "light"}
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "off",
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
          }}
          onMount={(_editor, monaco) => monaco.editor.remeasureFonts()}
        />
      </div>
    </div>
  );
}

function TestRow({ result, index }: { result: SubmissionResult; index: number }) {
  const t = useTranslations("submissions");
  const [diffOpen, setDiffOpen] = useState(false);
  const hasWaDiff =
    result.verdict === "WA" &&
    (result.actual_output !== null || result.expected_output_snippet !== null);
  const hasCeOrRe =
    (result.verdict === "CE" || result.verdict === "RE") && result.message;

  const isGood = result.verdict === "AC";

  return (
    <>
      <div
        className={cn(
          "grid grid-cols-[2rem_5rem_3rem_4rem_4rem] items-center gap-x-3 border-b border-border px-3 py-2 font-mono text-xs last:border-0",
          isGood ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span className="text-muted-foreground">{index + 1}</span>
        <VerdictBadge verdict={result.verdict} />
        <span className="text-right">{result.score}p</span>
        <span className="text-right">
          {result.execution_time_ms != null ? `${result.execution_time_ms}ms` : "—"}
        </span>
        <span className="text-right">
          {result.memory_kb != null ? `${result.memory_kb}K` : "—"}
        </span>

        {(hasWaDiff || hasCeOrRe) && (
          <button
            onClick={() => setDiffOpen((o) => !o)}
            className="col-span-full -mx-3 flex items-center gap-1 px-3 py-1 text-left text-[11px] text-muted-foreground hover:text-foreground"
            aria-expanded={diffOpen}
          >
            {diffOpen ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
            {hasWaDiff ? t("diffTitle") : t("compileError")}
          </button>
        )}
      </div>

      {diffOpen && hasWaDiff && (
        <WaDiff
          expected={result.expected_output_snippet}
          actual={result.actual_output}
        />
      )}

      {diffOpen && hasCeOrRe && result.message && (
        <div className="border-b border-border bg-destructive/5 px-4 py-3">
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-destructive">
            {result.message}
          </pre>
        </div>
      )}
    </>
  );
}

const PREVIEW_LINES = 20;

function WaDiff({
  expected,
  actual,
}: {
  expected: string | null;
  actual: string | null;
}) {
  const t = useTranslations("submissions");
  const [expanded, setExpanded] = useState(false);

  const expectedLines = (expected ?? "").split("\n");
  const actualLines = (actual ?? "").split("\n");
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  const showToggle = maxLen > PREVIEW_LINES;
  const visibleCount = expanded ? maxLen : Math.min(maxLen, PREVIEW_LINES);

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="grid grid-cols-2 divide-x divide-border">
        <DiffColumn
          title={t("expectedOutput")}
          lines={expectedLines}
          counterLines={actualLines}
          visibleCount={visibleCount}
        />
        <DiffColumn
          title={t("actualOutput")}
          lines={actualLines}
          counterLines={expectedLines}
          visibleCount={visibleCount}
          isActual
        />
      </div>
      {showToggle && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full py-1.5 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {expanded
            ? t("showLess")
            : t("showMore", { n: maxLen - PREVIEW_LINES })}
        </button>
      )}
    </div>
  );
}

function DiffColumn({
  title,
  lines,
  counterLines,
  visibleCount,
  isActual = false,
}: {
  title: string;
  lines: string[];
  counterLines: string[];
  visibleCount: number;
  isActual?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="border-b border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">
        {title}
      </div>
      <div className="overflow-x-auto">
        {Array.from({ length: visibleCount }, (_, i) => {
          const line = lines[i] ?? "";
          const counterLine = counterLines[i] ?? "";
          const differs = line !== counterLine;
          return (
            <div
              key={i}
              className={cn(
                "flex gap-2 px-3 py-px font-mono text-xs leading-5",
                differs
                  ? isActual
                    ? "bg-destructive/10 text-destructive"
                    : "bg-success/10 text-success"
                  : "",
              )}
            >
              <span className="w-6 shrink-0 select-none text-right text-muted-foreground/50">
                {i + 1}
              </span>
              <span className="break-all">{line}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-4 w-24" />
      <div className="mb-6 flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded" />
        ))}
      </div>
      <div className="mb-6 space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded" />
        ))}
      </div>
      <Skeleton className="h-[420px] w-full rounded" />
    </div>
  );
}
