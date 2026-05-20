"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertCircle, AlertTriangle, Maximize2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ContestDetailSchema, ProblemDetailSchema } from "@/lib/types";
import { ProblemStatement } from "@/components/problems/problem-statement";
import { SubmissionPanel } from "@/components/problems/submission-panel";
import { DifficultyIndicator } from "@/components/problems/difficulty-indicator";

interface Props {
  contestSlug: string;
  problemSlug: string;
}

function computeFingerprint(): string {
  const parts = [
    navigator.userAgent,
    `${screen.width}x${screen.height}`,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.language,
  ];
  return parts.join("|");
}

function logViolation(
  contestSlug: string,
  violationType: string,
  details?: Record<string, unknown>,
) {
  api
    .post(`/api/contests/${contestSlug}/violations`, {
      violation_type: violationType,
      details: details ?? null,
    })
    .catch(() => {});
}

function checkFingerprint(contestSlug: string) {
  const fp = computeFingerprint();
  api.post(`/api/contests/${contestSlug}/fingerprint`, { fingerprint: fp }).catch(() => {});
}

export default function ContestProblemClient({ contestSlug, problemSlug }: Props) {
  const t = useTranslations("problems");
  const tContests = useTranslations("contests");
  const { isAuthenticated } = useAuth();
  const [editorFocused, setEditorFocused] = useState(false);

  const [acknowledged, setAcknowledged] = useState(false);
  const [fullscreenExited, setFullscreenExited] = useState(false);
  const fingerprintSent = useRef(false);

  const { data: contest } = useQuery({
    queryKey: ["contest", contestSlug],
    queryFn: () => api.get(`/api/contests/${contestSlug}`, ContestDetailSchema),
  });

  const { data: problem, isLoading, error } = useQuery({
    queryKey: ["problem", problemSlug],
    queryFn: () => api.get(`/api/problems/${problemSlug}`, ProblemDetailSchema),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  const ackKey = `reinfo_ack_${contestSlug}`;

  useEffect(() => {
    if (typeof sessionStorage !== "undefined") {
      const wasAcknowledged = sessionStorage.getItem(ackKey) === "1";
      if (wasAcknowledged) setAcknowledged(true);
    }
  }, [ackKey]);

  useEffect(() => {
    if (!acknowledged || fingerprintSent.current || !isAuthenticated) return;
    fingerprintSent.current = true;
    checkFingerprint(contestSlug);
  }, [acknowledged, isAuthenticated, contestSlug]);

  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!acknowledged || !contest?.fullscreen_required) return;

    const handler = () => {
      if (!document.fullscreenElement) {
        setFullscreenExited(true);
        logViolation(contestSlug, "fullscreen_exit");
      }
    };

    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [acknowledged, contest?.fullscreen_required, contestSlug]);

  useEffect(() => {
    if (!acknowledged || !contest?.copy_paste_blocked) return;

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      logViolation(contestSlug, "paste_attempt");
    };

    document.addEventListener("paste", handlePaste, true);
    return () => document.removeEventListener("paste", handlePaste, true);
  }, [acknowledged, contest?.copy_paste_blocked, contestSlug]);

  function handleAcknowledge() {
    sessionStorage.setItem(ackKey, "1");
    setAcknowledged(true);
    if (contest?.fullscreen_required) {
      enterFullscreen();
    }
  }

  if (!acknowledged) {
    const rules: string[] = [];
    if (contest?.fullscreen_required) rules.push(tContests("contestRulesFullscreen"));
    if (contest?.copy_paste_blocked) rules.push(tContests("contestRulesCopyPaste"));
    rules.push(tContests("contestRulesMonitoring"));
    rules.push(tContests("contestRulesSourceCheck"));

    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" />
            <h2 className="text-base font-semibold">{tContests("contestAckTitle")}</h2>
          </div>
          <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
            {rules.map((r) => (
              <li key={r} className="flex items-start gap-2">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground" />
                {r}
              </li>
            ))}
          </ul>
          <Button onClick={handleAcknowledge} className="w-full">
            {contest?.fullscreen_required ? (
              <>
                <Maximize2 className="mr-2 h-4 w-4" />
                {tContests("contestAckFullscreen")}
              </>
            ) : (
              tContests("contestAckNormal")
            )}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        {tContests("loadingLeaderboard")}
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t("notFoundError")}</p>
        <Link
          href={`/concursuri/${contestSlug}`}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          {tContests("backToContestLink")}
        </Link>
      </div>
    );
  }

  const submitUrl = `/api/contests/${contestSlug}/problems/${problemSlug}/submit`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {fullscreenExited && (
        <div className="mb-4 flex items-center gap-3 rounded border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{tContests("fullscreenExitWarning")}</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0"
            onClick={() => {
              setFullscreenExited(false);
              enterFullscreen();
            }}
          >
            <Maximize2 className="mr-1.5 h-3.5 w-3.5" />
            {tContests("reenterFullscreen")}
          </Button>
        </div>
      )}

      <div className="mb-4">
        <Link
          href={`/concursuri/${contestSlug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {tContests("backToContestLink")}
        </Link>
      </div>

      <div
        className={`grid gap-6 ${editorFocused ? "lg:grid-cols-[360px_1fr]" : "lg:grid-cols-[1fr_360px]"}`}
      >
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{problem.title}</h1>
            <DifficultyIndicator difficulty={problem.difficulty} />
          </div>

          <Tabs defaultValue="statement">
            <TabsList className="mb-4">
              <TabsTrigger value="statement">{t("enunt")}</TabsTrigger>
            </TabsList>
            <TabsContent value="statement">
              <ProblemStatement markdown={problem.statement_md} />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <SubmissionPanel
            slug={problemSlug}
            scoreTotal={problem.score_total}
            bestScore={null}
            isAuthenticated={isAuthenticated}
            editorFocused={editorFocused}
            onToggleEditorFocus={() => setEditorFocused((v) => !v)}
            submitUrl={submitUrl}
          />
        </div>
      </div>
    </div>
  );
}
