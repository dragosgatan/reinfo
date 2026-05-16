"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Loader2, Send, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VerdictBadge } from "./verdict-badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SUPPORTED_LANGUAGES, LANGUAGE_LABELS, MONACO_LANGUAGE_MAP } from "@/lib/types";
import type { Submission, VerdictType } from "@/lib/types";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded border border-border bg-muted">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface SubmissionPanelProps {
  slug: string;
  scoreTotal: number;
  bestScore: number | null;
  isAuthenticated: boolean;
}

type PanelState = "idle" | "submitting" | "judging" | "done" | "error";

interface JudgingUpdate {
  verdict: VerdictType;
  score: number;
  job_status: string;
}

export function SubmissionPanel({
  slug,
  scoreTotal,
  bestScore,
  isAuthenticated,
}: SubmissionPanelProps) {
  const t = useTranslations("problems");
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [language, setLanguage] = useState("cpp");
  useEffect(() => { setMounted(true); }, []);
  const [code, setCode] = useState(DEFAULT_CODE["cpp"] ?? "");
  const [state, setState] = useState<PanelState>("idle");
  const [liveUpdate, setLiveUpdate] = useState<JudgingUpdate | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const abortRef = useRef<EventSource | null>(null);

  const handleLanguageChange = useCallback(
    (lang: string) => {
      setLanguage(lang);
      if (code === DEFAULT_CODE[language] || !code.trim()) {
        setCode(DEFAULT_CODE[lang] ?? "");
      }
    },
    [language, code],
  );

  const fetchFullSubmission = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as Submission;
        setSubmission(data);
        setState("done");
      } else {
        setState("done");
      }
    } catch {
      setState("done");
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!code.trim()) {
      toast.error(t("emptyCode"));
      return;
    }
    setState("submitting");
    setErrorMessage(null);
    setSubmission(null);
    setLiveUpdate(null);

    try {
      const formData = new FormData();
      formData.append("source_code", code);
      formData.append("language", language);

      const res = await fetch(`/api/problems/${slug}/submit`, {
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
  }, [code, language, slug, fetchFullSubmission, t]);

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
          <span className="font-mono text-sm font-semibold text-foreground">
            {bestScore}/{scoreTotal}
          </span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Select value={language} onValueChange={handleLanguageChange} disabled={isDisabled}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <SelectItem key={lang} value={lang}>
                {LANGUAGE_LABELS[lang]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {state === "done" || state === "error" ? (
          <Button variant="outline" size="sm" onClick={handleReset} className="shrink-0">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        ) : null}
      </div>

      <div className={cn("rounded border border-border overflow-hidden", isDisabled && "opacity-70")}>
        <MonacoEditor
          height="300px"
          language={MONACO_LANGUAGE_MAP[language] ?? "plaintext"}
          value={code}
          onChange={(v) => { if (v !== undefined) setCode(v); }}
          theme={mounted && resolvedTheme === "dark" ? "vs-dark" : "light"}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            readOnly: isDisabled,
            tabSize: 2,
            padding: { top: 8, bottom: 8 },
          }}
        />
      </div>

      {state === "idle" && (
        <Button type="button" onClick={handleSubmit} className="w-full gap-2" size="sm">
          <Send className="h-3.5 w-3.5" />
          {t("submitTitle")}
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

      {state === "done" && submission && (
        <SubmissionResult submission={submission} scoreTotal={scoreTotal} />
      )}
    </div>
  );
}

function SubmissionResult({
  submission,
  scoreTotal,
}: {
  submission: Submission;
  scoreTotal: number;
}) {
  const t = useTranslations("problems");
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded border border-border px-3 py-2">
        <VerdictBadge verdict={submission.verdict} />
        <span className="font-mono text-sm font-semibold">
          {submission.score}/{scoreTotal}
        </span>
      </div>

      {submission.results.length > 0 && (
        <div className="space-y-0.5">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("testResults")}
          </p>
          {submission.results.map((result, i) => (
            <div
              key={result.id}
              className={cn(
                "flex items-center gap-2 rounded px-2 py-1 font-mono text-xs",
                result.verdict === "AC"
                  ? "bg-success/5 text-success"
                  : "bg-destructive/5 text-destructive",
              )}
            >
              <span className="w-8 shrink-0 text-muted-foreground">#{i + 1}</span>
              <span className="w-8 shrink-0 font-semibold">{result.verdict}</span>
              {result.execution_time_ms != null && (
                <span className="text-muted-foreground">{result.execution_time_ms}ms</span>
              )}
              {result.memory_kb != null && (
                <span className="text-muted-foreground">{result.memory_kb}KB</span>
              )}
              <span className="ml-auto">{result.score}p</span>
            </div>
          ))}
        </div>
      )}

      {submission.verdict === "CE" && submission.results[0]?.message && (
        <>
          <Separator />
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("compileError")}
            </p>
            <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed text-destructive">
              {submission.results[0].message}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

const DEFAULT_CODE: Record<string, string> = {
  cpp: `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    // TODO

    return 0;
}`,
  c: `#include <stdio.h>
#include <stdlib.h>

int main() {
    // TODO
    return 0;
}`,
  python: `# TODO`,
  java: `import java.util.*;
import java.io.*;

public class Main {
    public static void main(String[] args) throws IOException {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        // TODO
    }
}`,
  kotlin: `import java.util.Scanner\n\nfun main() {\n    val sc = Scanner(System.\`in\`)\n    // TODO\n}`,
  rust: `use std::io::{self, BufRead};

fn main() {
    let stdin = io::stdin();
    // TODO
}`,
  go: `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    reader := bufio.NewReader(os.Stdin)
    _ = reader
    fmt.Println()
}`,
  javascript: `const lines = require('fs').readFileSync('/dev/stdin', 'utf8').split('\\n');
let i = 0;

// TODO`,
};
