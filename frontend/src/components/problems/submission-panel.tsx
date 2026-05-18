"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  Loader2,
  Send,
  RotateCcw,
  Settings2,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { VerdictBadge } from "./verdict-badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_LABELS,
  MONACO_LANGUAGE_MAP,
} from "@/lib/types";
import type { Submission, VerdictType } from "@/lib/types";
import {
  useEditorPrefs,
  EDITOR_THEME_LABELS,
  FONT_SIZES,
  TAB_SIZES,
  type EditorTheme,
} from "@/lib/use-editor-prefs";

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
  editorFocused?: boolean;
  onToggleEditorFocus?: () => void;
  submitUrl?: string;
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
  editorFocused = false,
  onToggleEditorFocus,
  submitUrl,
}: SubmissionPanelProps) {
  const t = useTranslations("problems");
  const {
    mounted,
    language,
    editorTheme,
    fontSize,
    tabSize,
    activeMonacoTheme,
    setLanguage: setLanguagePref,
    setEditorTheme,
    setFontSize,
    setTabSize,
  } = useEditorPrefs("python");
  const [code, setCode] = useState(DEFAULT_CODE["python"] ?? "");
  const [state, setState] = useState<PanelState>("idle");
  const [liveUpdate, setLiveUpdate] = useState<JudgingUpdate | null>(null);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const abortRef = useRef<EventSource | null>(null);
  const submitCallbackRef = useRef<(() => void)>(() => {});

  const handleLanguageChange = useCallback(
    (lang: string) => {
      setLanguagePref(lang);
      if (code === DEFAULT_CODE[language] || !code.trim()) {
        setCode(DEFAULT_CODE[lang] ?? "");
      }
    },
    [language, code, setLanguagePref],
  );

  const handleThemeChange = useCallback((theme: EditorTheme) => {
    setEditorTheme(theme);
  }, [setEditorTheme]);

  const handleFontSizeChange = useCallback((size: number) => {
    setFontSize(size);
  }, [setFontSize]);

  const handleTabSizeChange = useCallback((size: number) => {
    setTabSize(size);
  }, [setTabSize]);

  const fetchFullSubmission = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/submissions/${id}`, {
        credentials: "include",
      });
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

      const res = await fetch(submitUrl ?? `/api/problems/${slug}/submit`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(
          (payload as { detail?: string }).detail ?? res.statusText,
        );
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
      setErrorMessage(
        err instanceof Error ? err.message : t("errorGeneric"),
      );
    }
  }, [code, language, slug, submitUrl, fetchFullSubmission, t]);

  useEffect(() => {
    submitCallbackRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleReset = useCallback(() => {
    abortRef.current?.close();
    setState("idle");
    setSubmission(null);
    setLiveUpdate(null);
    setErrorMessage(null);
  }, []);

  const handleBeforeMount = useCallback(
    (
      monacoInstance: Parameters<
        NonNullable<React.ComponentProps<typeof MonacoEditor>["beforeMount"]>
      >[0],
    ) => {
      monacoInstance.editor.defineTheme("reinfo-github-dark", GITHUB_DARK_THEME);
      monacoInstance.editor.defineTheme("reinfo-dracula", DRACULA_THEME);
    },
    [],
  );

  const handleEditorMount = useCallback(
    (
      editor: Parameters<
        NonNullable<React.ComponentProps<typeof MonacoEditor>["onMount"]>
      >[0],
      monacoInstance: Parameters<
        NonNullable<React.ComponentProps<typeof MonacoEditor>["onMount"]>
      >[1],
    ) => {
      editor.addCommand(
        monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.Enter,
        () => { submitCallbackRef.current(); },
      );
      monacoInstance.editor.remeasureFonts();
    },
    [],
  );

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

  const editorNode = (
    <div
      className={cn(
        "rounded border border-border overflow-hidden",
        isDisabled && "opacity-70",
        fullscreen && "flex-1 min-h-0",
      )}
    >
      <MonacoEditor
        height={fullscreen ? "100%" : "420px"}
        language={MONACO_LANGUAGE_MAP[language] ?? "plaintext"}
        value={code}
        onChange={(v) => {
          if (v !== undefined) setCode(v);
        }}
        theme={activeMonacoTheme}
        beforeMount={handleBeforeMount}
        onMount={handleEditorMount}
        options={{
          minimap: { enabled: false },
          automaticLayout: true,
          fontSize,
          fontFamily: "'JetBrains Mono', monospace",
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          readOnly: isDisabled,
          tabSize,
          padding: { top: 8, bottom: 8 },
        }}
      />
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-1.5">
      <Select
        value={language}
        onValueChange={handleLanguageChange}
        disabled={isDisabled}
      >
        <SelectTrigger className="flex-1 min-w-0">
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

      <Select
        value={editorTheme}
        onValueChange={(v) => handleThemeChange(v as EditorTheme)}
        disabled={isDisabled}
      >
        <SelectTrigger className="w-[90px] shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {(Object.keys(EDITOR_THEME_LABELS) as EditorTheme[]).map((theme) => (
            <SelectItem key={theme} value={theme} className="text-xs">
              {EDITOR_THEME_LABELS[theme]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 shrink-0"
            aria-label="Editor settings"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Font size
              </Label>
              <div className="flex gap-1 flex-wrap">
                {FONT_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleFontSizeChange(size)}
                    className={cn(
                      "rounded border px-2 py-0.5 font-mono text-xs transition-colors",
                      fontSize === size
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Tab width</Label>
              <div className="flex gap-1">
                {TAB_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleTabSizeChange(size)}
                    className={cn(
                      "rounded border px-3 py-0.5 font-mono text-xs transition-colors",
                      tabSize === size
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {onToggleEditorFocus && (
        <Button
          variant={editorFocused ? "default" : "outline"}
          size="sm"
          className="hidden lg:flex h-9 shrink-0 gap-1.5 px-2.5"
          onClick={onToggleEditorFocus}
          aria-label={editorFocused ? "Minimizează editorul" : "Maximizează editorul"}
        >
          {editorFocused ? (
            <><Minimize2 className="h-3.5 w-3.5" /><span className="text-xs">Minimize</span></>
          ) : (
            <><Maximize2 className="h-3.5 w-3.5" /><span className="text-xs">Maximize</span></>
          )}
        </Button>
      )}

      {fullscreen ? (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 lg:hidden"
          onClick={() => setFullscreen(false)}
          aria-label="Ieși din fullscreen"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 lg:hidden"
          onClick={() => setFullscreen(true)}
          aria-label="Fullscreen editor"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      )}

      {(state === "done" || state === "error") && (
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleReset}
          aria-label="Resetează"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );

  const submitArea = (
    <>
      {state === "idle" && (
        <Button
          type="button"
          onClick={handleSubmit}
          className={cn("gap-2", fullscreen ? "w-full" : "w-full")}
          size="sm"
        >
          <Send className="h-3.5 w-3.5" />
          {t("submitTitle")}
          <span className="ml-auto font-mono text-[10px] opacity-60">
            Ctrl+Enter
          </span>
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
    </>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col gap-2 bg-background p-3">
        {toolbar}
        {editorNode}
        <div className="shrink-0">{submitArea}</div>
      </div>
    );
  }

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

      {toolbar}
      {editorNode}
      {submitArea}
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
              <span className="w-8 shrink-0 text-muted-foreground">
                #{i + 1}
              </span>
              <span className="w-8 shrink-0 font-semibold">
                {result.verdict}
              </span>
              {result.execution_time_ms != null && (
                <span className="text-muted-foreground">
                  {result.execution_time_ms}ms
                </span>
              )}
              {result.memory_kb != null && (
                <span className="text-muted-foreground">
                  {result.memory_kb}KB
                </span>
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

const GITHUB_DARK_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "8b949e", fontStyle: "italic" },
    { token: "comment.line", foreground: "8b949e", fontStyle: "italic" },
    { token: "comment.block", foreground: "8b949e", fontStyle: "italic" },
    { token: "keyword", foreground: "ff7b72" },
    { token: "keyword.control", foreground: "ff7b72" },
    { token: "storage.type", foreground: "ff7b72" },
    { token: "string", foreground: "a5d6ff" },
    { token: "string.quoted", foreground: "a5d6ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "constant.numeric", foreground: "79c0ff" },
    { token: "type", foreground: "ffa657" },
    { token: "entity.name.type", foreground: "ffa657" },
    { token: "entity.name.function", foreground: "d2a8ff" },
    { token: "support.function", foreground: "d2a8ff" },
    { token: "variable", foreground: "c9d1d9" },
    { token: "constant", foreground: "79c0ff" },
    { token: "operator", foreground: "ff7b72" },
    { token: "punctuation", foreground: "c9d1d9" },
    { token: "tag", foreground: "7ee787" },
    { token: "attribute.name", foreground: "ffa657" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#c9d1d9",
    "editor.lineHighlightBackground": "#161b22",
    "editorLineNumber.foreground": "#484f58",
    "editorLineNumber.activeForeground": "#c9d1d9",
    "editor.selectionBackground": "#264f78",
    "editor.inactiveSelectionBackground": "#264f7840",
    "editorCursor.foreground": "#c9d1d9",
    "editor.wordHighlightBackground": "#388bfd26",
    "editorWidget.background": "#161b22",
    "editorWidget.border": "#30363d",
    "editorGutter.background": "#0d1117",
    "editorIndentGuide.background1": "#21262d",
    "editorIndentGuide.activeBackground1": "#30363d",
  },
};

const DRACULA_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "6272a4", fontStyle: "italic" },
    { token: "comment.line", foreground: "6272a4", fontStyle: "italic" },
    { token: "comment.block", foreground: "6272a4", fontStyle: "italic" },
    { token: "keyword", foreground: "ff79c6" },
    { token: "keyword.control", foreground: "ff79c6" },
    { token: "storage.type", foreground: "ff79c6" },
    { token: "string", foreground: "f1fa8c" },
    { token: "string.quoted", foreground: "f1fa8c" },
    { token: "number", foreground: "bd93f9" },
    { token: "constant.numeric", foreground: "bd93f9" },
    { token: "type", foreground: "8be9fd" },
    { token: "entity.name.type", foreground: "8be9fd" },
    { token: "entity.name.function", foreground: "50fa7b" },
    { token: "support.function", foreground: "50fa7b" },
    { token: "variable", foreground: "f8f8f2" },
    { token: "constant", foreground: "bd93f9" },
    { token: "operator", foreground: "ff79c6" },
    { token: "punctuation", foreground: "f8f8f2" },
    { token: "tag", foreground: "ff79c6" },
    { token: "attribute.name", foreground: "50fa7b" },
  ],
  colors: {
    "editor.background": "#282a36",
    "editor.foreground": "#f8f8f2",
    "editor.lineHighlightBackground": "#44475a",
    "editorLineNumber.foreground": "#6272a4",
    "editorLineNumber.activeForeground": "#f8f8f2",
    "editor.selectionBackground": "#44475a",
    "editor.inactiveSelectionBackground": "#44475a80",
    "editorCursor.foreground": "#f8f8f2",
    "editor.wordHighlightBackground": "#8be9fd26",
    "editorWidget.background": "#21222c",
    "editorWidget.border": "#6272a4",
    "editorGutter.background": "#282a36",
    "editorIndentGuide.background1": "#3d3f4e",
    "editorIndentGuide.activeBackground1": "#4d4f5e",
  },
};

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
