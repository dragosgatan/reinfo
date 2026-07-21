"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send, RotateCcw, Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerdictBadge } from "./verdict-badge";
import { cn } from "@/lib/utils";
import { DATASET_METRIC_LABELS } from "@/lib/types";
import type { DatasetMetric, Submission, VerdictType } from "@/lib/types";

interface DatasetPanelProps {
  slug: string;
  isAuthenticated: boolean;
  bestScore: number | null;
  metric: DatasetMetric | null;
  requireSource?: boolean;
  submitUrl?: string;
}

type PanelState = "idle" | "submitting" | "judging" | "done" | "error";

interface JudgingUpdate {
  verdict: VerdictType;
  score: number;
  job_status: string;
}

interface CsvPreview {
  columns: string[];
  rows: string[][];
  rowCount: number;
}

function parseCsvPreview(text: string): CsvPreview {
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  const columns = (lines[0] ?? "").split(",").map((c) => c.trim());
  const rows = lines.slice(1, 6).map((l) => l.split(","));
  return { columns, rows, rowCount: Math.max(0, lines.length - 1) };
}

export function DatasetPanel({
  slug,
  isAuthenticated,
  bestScore,
  metric,
  requireSource = false,
  submitUrl,
}: DatasetPanelProps) {
  const t = useTranslations("problems");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [state, setState] = useState<PanelState>("idle");
  const [liveUpdate, setLiveUpdate] = useState<JudgingUpdate | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const sourceInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<EventSource | null>(null);

  const handleCsvSelected = useCallback((file: File) => {
    setCsvFile(file);
    file
      .text()
      .then((text) => setCsvPreview(parseCsvPreview(text)))
      .catch(() => setCsvPreview(null));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleCsvSelected(file);
    },
    [handleCsvSelected],
  );

  const fetchFullSubmission = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, { credentials: "include" });
      if (res.ok) {
        setSubmission((await res.json()) as Submission);
      }
    } finally {
      setState("done");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!csvFile) {
      toast.error(t("datasetCsvRequired"));
      return;
    }
    if (requireSource && !sourceFile) {
      toast.error(t("datasetSourceRequired"));
      return;
    }

    setState("submitting");
    setErrorMessage(null);
    setSubmission(null);
    setLiveUpdate(null);

    try {
      const formData = new FormData();
      formData.append("csv_file", csvFile);
      if (sourceFile) formData.append("source_file", sourceFile);

      const res = await fetch(submitUrl ?? `/api/problems/${slug}/submit-dataset`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { detail?: string }).detail ?? res.statusText);
      }

      const sub = (await res.json()) as Submission;
      setState("judging");

      const es = new EventSource(`/api/submissions/${sub.id}/stream`);
      abortRef.current = es;

      es.onmessage = (event) => {
        const data = JSON.parse(event.data) as JudgingUpdate;
        setLiveUpdate(data);
        if (data.job_status === "done" || data.job_status === "failed") {
          es.close();
          fetchFullSubmission(sub.id);
        }
      };

      es.onerror = () => {
        es.close();
        fetchFullSubmission(sub.id);
      };
    } catch (err) {
      setState("error");
      setErrorMessage(err instanceof Error ? err.message : t("errorGeneric"));
    }
  }, [csvFile, sourceFile, requireSource, slug, submitUrl, fetchFullSubmission, t]);

  const handleReset = useCallback(() => {
    abortRef.current?.close();
    setState("idle");
    setSubmission(null);
    setLiveUpdate(null);
    setErrorMessage(null);
  }, []);

  if (!isAuthenticated) {
    return (
      <p className="text-sm text-muted-foreground">
        <a href="/login" className="font-medium text-primary hover:underline">
          {t("loginAction")}
        </a>{" "}
        {t("loginToSubmit")}
      </p>
    );
  }

  const isDisabled = state === "submitting" || state === "judging";

  return (
    <div className="space-y-3">
      {bestScore !== null && (
        <div className="flex items-center justify-between rounded border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground">{t("bestScore")}</span>
          <span className="font-mono text-sm font-semibold text-foreground">{bestScore}/100</span>
        </div>
      )}

      {metric && (
        <p className="text-xs text-muted-foreground">
          {t("metricLabel")}: <span className="font-mono">{DATASET_METRIC_LABELS[metric]}</span>
        </p>
      )}

      <div>
        <input
          ref={csvInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          disabled={isDisabled}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleCsvSelected(file);
          }}
        />
        {csvFile ? (
          <div className="rounded border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-1.5 truncate text-xs">
                <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-mono">{csvFile.name}</span>
              </span>
              {!isDisabled && (
                <button
                  type="button"
                  onClick={() => {
                    setCsvFile(null);
                    setCsvPreview(null);
                    if (csvInputRef.current) csvInputRef.current.value = "";
                  }}
                  aria-label={t("removeFile")}
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {csvPreview && (
              <div className="mt-2 overflow-x-auto">
                <p className="mb-1 text-[11px] text-muted-foreground">
                  {t("datasetPreviewRows", { rows: csvPreview.rowCount })}
                </p>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr>
                      {csvPreview.columns.map((col, i) => (
                        <th
                          key={i}
                          className="border-b border-border px-1.5 py-1 text-left font-mono font-medium text-muted-foreground"
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvPreview.rows.map((row, ri) => (
                      <tr key={ri}>
                        {row.map((cell, ci) => (
                          <td key={ci} className="px-1.5 py-1 font-mono">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={isDisabled}
            onClick={() => csvInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded border border-dashed px-4 py-8 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border hover:border-foreground/30",
            )}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{t("datasetCsvDropzone")}</span>
          </button>
        )}
      </div>

      <div>
        <input
          ref={sourceInputRef}
          type="file"
          accept=".py"
          className="hidden"
          disabled={isDisabled}
          onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center justify-between gap-2 rounded border border-border px-3 py-2">
          <span className="flex min-w-0 items-center gap-1.5 truncate text-xs">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {sourceFile ? (
              <span className="truncate font-mono">{sourceFile.name}</span>
            ) : (
              <span className="text-muted-foreground">
                {t("datasetSourceLabel")}{" "}
                {requireSource ? (
                  <span className="text-destructive">({t("datasetSourceRequired")})</span>
                ) : (
                  `(${t("datasetSourceOptional")})`
                )}
              </span>
            )}
          </span>
          <div className="flex shrink-0 items-center gap-2">
            {sourceFile && !isDisabled && (
              <button
                type="button"
                onClick={() => {
                  setSourceFile(null);
                  if (sourceInputRef.current) sourceInputRef.current.value = "";
                }}
                aria-label={t("removeFile")}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              disabled={isDisabled}
              onClick={() => sourceInputRef.current?.click()}
            >
              {sourceFile ? t("datasetChangeFile") : t("choose")}
            </Button>
          </div>
        </div>
      </div>

      {state === "idle" && (
        <Button type="button" onClick={handleSubmit} className="w-full gap-2" size="sm">
          <Send className="h-3.5 w-3.5" />
          {t("datasetSubmitAction")}
        </Button>
      )}

      {(state === "submitting" || state === "judging") && (
        <div className="flex items-center justify-center gap-2 rounded border border-border py-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {state === "submitting" ? t("submitting") : t("judging")}
          {liveUpdate && state === "judging" && (
            <span className="font-mono text-xs">{liveUpdate.score} pct</span>
          )}
        </div>
      )}

      {state === "error" && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {errorMessage ?? t("errorGeneric")}
        </div>
      )}

      {state === "done" && submission && <DatasetResult submission={submission} />}

      {(state === "done" || state === "error") && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-2"
          onClick={handleReset}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t("resetAction")}
        </Button>
      )}
    </div>
  );
}

function DatasetResult({ submission }: { submission: Submission }) {
  const t = useTranslations("problems");
  const result = submission.results[0];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded border border-border px-3 py-2">
        <VerdictBadge verdict={submission.verdict} />
        <span className="font-mono text-sm font-semibold">{submission.score}/100</span>
      </div>
      {result?.metric_value != null && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t("datasetMetricValue")}</span>
          <span className="font-mono">{result.metric_value.toFixed(4)}</span>
        </div>
      )}
      {submission.verdict === "INVALID_FORMAT" && result?.message && (
        <div className="rounded border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
          {result.message}
        </div>
      )}
      {submission.manual_review && (
        <p className="text-[11px] text-muted-foreground">{t("datasetManualReview")}</p>
      )}
    </div>
  );
}
