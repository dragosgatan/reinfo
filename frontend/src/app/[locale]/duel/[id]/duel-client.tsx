"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { toast } from "sonner";
import {
  AlertTriangle,
  Clock,
  Flag,
  Handshake,
  Loader2,
  Send,
  Settings2,
  Trophy,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { VerdictBadge } from "@/components/problems/verdict-badge";
import { ProblemStatement } from "@/components/problems/problem-statement";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useDuelWs } from "@/lib/use-duel-ws";
import { useEditorPrefs, EDITOR_THEME_LABELS, FONT_SIZES, TAB_SIZES, type EditorTheme } from "@/lib/use-editor-prefs";
import {
  LANGUAGE_LABELS,
  MONACO_LANGUAGE_MAP,
  ProblemReadSchema,
  SUPPORTED_LANGUAGES,
  type DuelPlayerState,
  type DuelRead,
  type ProblemRead,
  type VerdictType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-muted">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  ),
});

interface DuelClientProps {
  duelId: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const GITHUB_DARK_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "8b949e", fontStyle: "italic" },
    { token: "keyword", foreground: "ff7b72" },
    { token: "keyword.control", foreground: "ff7b72" },
    { token: "storage.type", foreground: "ff7b72" },
    { token: "string", foreground: "a5d6ff" },
    { token: "number", foreground: "79c0ff" },
    { token: "type", foreground: "ffa657" },
    { token: "entity.name.function", foreground: "d2a8ff" },
    { token: "variable", foreground: "c9d1d9" },
    { token: "operator", foreground: "ff7b72" },
  ],
  colors: {
    "editor.background": "#0d1117",
    "editor.foreground": "#c9d1d9",
    "editor.lineHighlightBackground": "#161b22",
    "editorLineNumber.foreground": "#484f58",
    "editorLineNumber.activeForeground": "#c9d1d9",
    "editor.selectionBackground": "#264f78",
    "editorCursor.foreground": "#c9d1d9",
    "editorGutter.background": "#0d1117",
  },
};

const DRACULA_THEME = {
  base: "vs-dark" as const,
  inherit: true,
  rules: [
    { token: "comment", foreground: "6272a4", fontStyle: "italic" },
    { token: "keyword", foreground: "ff79c6" },
    { token: "storage.type", foreground: "ff79c6" },
    { token: "string", foreground: "f1fa8c" },
    { token: "number", foreground: "bd93f9" },
    { token: "type", foreground: "8be9fd" },
    { token: "entity.name.function", foreground: "50fa7b" },
    { token: "variable", foreground: "f8f8f2" },
    { token: "operator", foreground: "ff79c6" },
  ],
  colors: {
    "editor.background": "#282a36",
    "editor.foreground": "#f8f8f2",
    "editor.lineHighlightBackground": "#44475a",
    "editorLineNumber.foreground": "#6272a4",
    "editorLineNumber.activeForeground": "#f8f8f2",
    "editor.selectionBackground": "#44475a",
    "editorCursor.foreground": "#f8f8f2",
    "editorGutter.background": "#282a36",
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

function PlayerPanel({
  player,
  label,
  isMe,
}: {
  player: DuelPlayerState;
  label: string;
  isMe: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded border px-3 py-2",
        isMe ? "border-primary/30 bg-primary/5" : "border-border bg-muted/20",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </span>
          <span className="font-mono text-sm font-semibold truncate">
            {player.username}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{player.duel_rating} Elo</span>
          <span>·</span>
          <span>{player.score} pct</span>
        </div>
      </div>
      <div>
        {player.best_verdict ? (
          <VerdictBadge verdict={player.best_verdict as VerdictType} />
        ) : (
          <span className="text-xs text-muted-foreground font-mono">—</span>
        )}
      </div>
    </div>
  );
}

function FinishedOverlay({
  duel,
  myUserId,
  onClose,
}: {
  duel: DuelRead;
  myUserId: string;
  onClose: () => void;
}) {
  const isChallenger = duel.challenger.user_id === myUserId;
  const me = isChallenger ? duel.challenger : duel.opponent;
  const them = isChallenger ? duel.opponent : duel.challenger;

  let resultText = "";
  let resultClass = "";
  if (duel.status === "drawn") {
    resultText = "Remiză";
    resultClass = "text-warning";
  } else if (duel.winner_id === myUserId) {
    resultText = "Victorie!";
    resultClass = "text-success";
  } else {
    resultText = "Înfrângere";
    resultClass = "text-destructive";
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="relative w-full max-w-sm rounded-lg border border-border bg-background p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-4 flex justify-center">
          <Trophy className={cn("h-10 w-10", resultClass)} />
        </div>

        <h2 className={cn("text-center text-2xl font-bold mb-4", resultClass)}>
          {resultText}
        </h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tu ({me.username})</span>
            <span className="font-mono font-semibold">{me.score} pct</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Adversar ({them.username})</span>
            <span className="font-mono font-semibold">{them.score} pct</span>
          </div>
        </div>

        <div className="mt-4 border-t border-border pt-4 text-center">
          <p className="text-xs text-muted-foreground">Rating-ul Elo s-a actualizat</p>
          <p className="mt-1 text-lg font-mono font-bold">{me.duel_rating}</p>
        </div>
      </div>
    </div>
  );
}

export function DuelClient({ duelId }: DuelClientProps) {
  const { user } = useAuth();
  const { duel, secondsRemaining, status } = useDuelWs(duelId);

  const {
    language,
    editorTheme,
    fontSize,
    tabSize,
    activeMonacoTheme,
    setLanguage,
    setEditorTheme,
    setFontSize,
    setTabSize,
  } = useEditorPrefs("python");

  const [code, setCode] = useState(DEFAULT_CODE["python"] ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [showResignDialog, setShowResignDialog] = useState(false);
  const [showDrawDialog, setShowDrawDialog] = useState(false);
  const [showFinished, setShowFinished] = useState(false);
  const [drawSecondsLeft, setDrawSecondsLeft] = useState<number | null>(null);
  const [problem, setProblem] = useState<ProblemRead | null>(null);
  const prevStatusRef = useRef<string | null>(null);
  const submitCallbackRef = useRef<(() => void)>(() => {});

  // Fetch problem statement once we know the slug
  useEffect(() => {
    if (!duel?.problem_slug) return;
    api.get(`/api/problems/${duel.problem_slug}`)
      .then((raw) => {
        const parsed = ProblemReadSchema.safeParse(raw);
        if (parsed.success) setProblem(parsed.data);
      })
      .catch(() => {});
  }, [duel?.problem_slug]);

  // When language changes, reset code to template if still on a default
  const handleLanguageChange = useCallback(
    (lang: string) => {
      const currentDefault = DEFAULT_CODE[language] ?? "";
      setLanguage(lang);
      setCode((prev) => (prev === currentDefault || !prev.trim() ? DEFAULT_CODE[lang] ?? "" : prev));
    },
    [language, setLanguage],
  );

  useEffect(() => {
    if (
      duel &&
      (duel.status === "finished" || duel.status === "resigned" || duel.status === "drawn") &&
      prevStatusRef.current === "active"
    ) {
      setShowFinished(true);
    }
    if (duel) {
      prevStatusRef.current = duel.status;
    }
  }, [duel]);

  useEffect(() => {
    if (duel?.draw_offered_by && user && duel.draw_offered_by !== user.id) {
      toast.info("Adversarul tău a oferit remiză — răspunde în 60s.");
    }
  }, [duel?.draw_offered_by, user]);

  // Countdown for the draw offer timer
  useEffect(() => {
    if (!duel?.draw_offered_at) {
      setDrawSecondsLeft(null);
      return;
    }
    const update = () => {
      const elapsed = (Date.now() - new Date(duel.draw_offered_at!).getTime()) / 1000;
      const left = Math.max(0, Math.ceil(60 - elapsed));
      setDrawSecondsLeft(left);
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [duel?.draw_offered_at]);

  const handleSubmit = useCallback(async () => {
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      const result = await api.post<{ submission_id: string }>(
        `/api/duels/${duelId}/submit`,
        { source_code: code, language },
      );
      toast.success(`Cod trimis! ID: ${result.submission_id.slice(0, 8)}…`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare la trimitere");
    } finally {
      setSubmitting(false);
    }
  }, [code, duelId, language, submitting]);

  useEffect(() => {
    submitCallbackRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleResign = useCallback(async () => {
    try {
      await api.post(`/api/duels/${duelId}/resign`, {});
      setShowResignDialog(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare");
    }
  }, [duelId]);

  const handleOfferDraw = useCallback(async () => {
    try {
      await api.post(`/api/duels/${duelId}/offer-draw`, {});
      setShowDrawDialog(false);
      toast.info("Ofertă de remiză trimisă.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare");
    }
  }, [duelId]);

  const handleRespondDraw = useCallback(
    async (accept: boolean) => {
      try {
        await api.post(`/api/duels/${duelId}/respond-draw`, { accept });
        setShowDrawDialog(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Eroare");
      }
    },
    [duelId],
  );

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

  if (status === "connecting" && !duel) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!duel) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-muted-foreground text-sm">
        Duelul nu a fost găsit sau nu ai acces.
      </div>
    );
  }

  const isChallenger = user?.id === duel.challenger.user_id;
  const me = isChallenger ? duel.challenger : duel.opponent;
  const them = isChallenger ? duel.opponent : duel.challenger;
  const isActive = duel.status === "active";
  const isFinished =
    duel.status === "finished" || duel.status === "resigned" || duel.status === "drawn";
  const drawPending = duel.draw_offered_by !== null;
  const iOfferedDraw = duel.draw_offered_by === user?.id;
  const theyOfferedDraw = drawPending && !iOfferedDraw;

  const timerCritical = secondsRemaining !== null && secondsRemaining <= 300;

  return (
    <>
      {showFinished && user && (
        <FinishedOverlay
          duel={duel}
          myUserId={user.id}
          onClose={() => setShowFinished(false)}
        />
      )}

      <Dialog open={showResignDialog} onOpenChange={setShowResignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abandonezi duelul?</DialogTitle>
            <DialogDescription>
              Adversarul tău va câștiga imediat. Această acțiune este ireversibilă.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResignDialog(false)}>
              Anulează
            </Button>
            <Button variant="destructive" onClick={handleResign}>
              Abandonează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDrawDialog} onOpenChange={setShowDrawDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ofertă de remiză</DialogTitle>
            <DialogDescription>
              {theyOfferedDraw
                ? `${them.username} îți propune remiză. Accepti?`
                : "Ești sigur că vrei să oferi remiză?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {theyOfferedDraw ? (
              <>
                <Button variant="outline" onClick={() => handleRespondDraw(false)}>
                  Refuză
                </Button>
                <Button onClick={() => handleRespondDraw(true)}>Acceptă</Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDrawDialog(false)}>
                  Anulează
                </Button>
                <Button onClick={handleOfferDraw}>Trimite oferta</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2">
          <div className="flex-1 min-w-0">
            <span className="font-mono text-sm font-semibold truncate">
              {duel.problem_title}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              vs {them.username}
            </span>
          </div>

          {secondsRemaining !== null && isActive && (
            <div
              className={cn(
                "flex items-center gap-1.5 font-mono text-sm font-semibold tabular-nums",
                timerCritical ? "text-destructive" : "text-foreground",
              )}
            >
              <Clock className="h-3.5 w-3.5" />
              {formatTime(secondsRemaining)}
            </div>
          )}

          {isFinished && (
            <Badge variant="secondary" className="font-mono text-xs">
              {duel.status === "drawn"
                ? "Remiză"
                : duel.winner_id === user?.id
                  ? "Câștigat"
                  : "Pierdut"}
            </Badge>
          )}

          {isActive && (
            <div className="flex items-center gap-1.5">
              {theyOfferedDraw ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    <Handshake className="inline h-3 w-3 mr-1" />
                    Remiză propusă
                    {drawSecondsLeft !== null && (
                      <span className={cn("ml-1 font-mono", drawSecondsLeft <= 10 && "text-destructive")}>
                        ({drawSecondsLeft}s)
                      </span>
                    )}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-success border-success/40 hover:bg-success/10 hover:text-success"
                    onClick={() => handleRespondDraw(true)}
                  >
                    Acceptă
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handleRespondDraw(false)}
                  >
                    Refuză
                  </Button>
                </div>
              ) : iOfferedDraw ? (
                <Badge variant="outline" className="text-xs text-muted-foreground gap-1">
                  <Handshake className="h-3 w-3" />
                  Remiză oferită
                  {drawSecondsLeft !== null && (
                    <span className={cn("font-mono", drawSecondsLeft <= 10 && "text-destructive")}>
                      {drawSecondsLeft}s
                    </span>
                  )}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setShowDrawDialog(true)}
                >
                  <Handshake className="h-3.5 w-3.5" />
                  Remiză
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
                onClick={() => setShowResignDialog(true)}
              >
                <Flag className="h-3.5 w-3.5" />
                Abandon
              </Button>
            </div>
          )}
        </div>

        {/* Main split */}
        <div className="flex min-h-0 flex-1">
          {/* Left: Problem statement + players */}
          <div className="flex w-[42%] shrink-0 flex-col border-r border-border">
            {/* Players */}
            <div className="shrink-0 p-4 space-y-2 border-b border-border">
              <PlayerPanel player={me} label="Tu" isMe />
              <PlayerPanel player={them} label="Adversar" isMe={false} />
            </div>

            {/* Timer warning */}
            {timerCritical && secondsRemaining !== null && (
              <div className="shrink-0 mx-4 mt-3 flex items-center gap-2 rounded border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {secondsRemaining <= 60
                  ? "Mai puțin de 1 minut!"
                  : "Mai puțin de 5 minute!"}
              </div>
            )}

            {/* Problem statement */}
            <div className="flex-1 overflow-y-auto px-4 py-3">
              {problem ? (
                <>
                  <div className="mb-3 flex items-baseline gap-2">
                    <h2 className="font-semibold text-sm">{problem.title}</h2>
                    <span className="text-xs text-muted-foreground font-mono">
                      {problem.time_limit_ms}ms · {problem.memory_limit_kb}KB
                    </span>
                  </div>
                  <ProblemStatement markdown={problem.statement_md} />
                </>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Se încarcă enunțul…
                </div>
              )}
            </div>
          </div>

          {/* Right: Editor */}
          <div className="flex min-w-0 flex-1 flex-col">
            {/* Editor toolbar */}
            <div className="flex shrink-0 items-center gap-1.5 border-b border-border px-3 py-1.5">
              <Select value={language} onValueChange={handleLanguageChange} disabled={!isActive}>
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang} className="text-xs">
                      {LANGUAGE_LABELS[lang]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={editorTheme}
                onValueChange={(v) => setEditorTheme(v as EditorTheme)}
              >
                <SelectTrigger className="h-7 w-[80px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {(Object.keys(EDITOR_THEME_LABELS) as EditorTheme[]).map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {EDITOR_THEME_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-7 w-7 shrink-0">
                    <Settings2 className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Font size</Label>
                      <div className="flex gap-1 flex-wrap">
                        {FONT_SIZES.map((size) => (
                          <button
                            key={size}
                            onClick={() => setFontSize(size)}
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
                            onClick={() => setTabSize(size)}
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

              <div className="flex-1" />
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={!isActive || submitting}
                onClick={handleSubmit}
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" />
                )}
                Trimite
                <span className="ml-1 font-mono text-[10px] opacity-60 hidden sm:inline">Ctrl+Enter</span>
              </Button>
            </div>

            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={MONACO_LANGUAGE_MAP[language] ?? language}
                value={code}
                onChange={(v) => setCode(v ?? "")}
                theme={activeMonacoTheme}
                beforeMount={handleBeforeMount}
                onMount={handleEditorMount}
                options={{
                  fontSize,
                  fontFamily: "'JetBrains Mono', monospace",
                  tabSize,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  readOnly: !isActive,
                  wordWrap: "off",
                  lineNumbers: "on",
                  renderLineHighlight: "line",
                  padding: { top: 8, bottom: 8 },
                  automaticLayout: true,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
