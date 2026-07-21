"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Download, Droplet, Loader2, Lock, Pencil, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProblemStatement } from "@/components/problems/problem-statement";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import {
  CtfChallengeDetailSchema,
  CtfFlagSubmitResultSchema,
  type CtfChallengeDetail,
  type CtfHint,
} from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
}

export function CtfChallengeClient({ slug }: Props) {
  const t = useTranslations("ctf");
  const { user, isAuthenticated } = useAuth();

  const {
    data: challenge,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["ctf-challenge", slug],
    queryFn: () => api.get(`/api/ctf/${slug}`, CtfChallengeDetailSchema),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (isLoading) return null;

  if (error || !challenge) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Link href="/probleme?tab=ctf" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToCtf")}
        </Link>
      </div>
    );
  }

  const canEdit =
    user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";

  return (
    <CtfChallengeLayout challenge={challenge} isAuthenticated={isAuthenticated} canEdit={canEdit} />
  );
}

function CtfChallengeLayout({
  challenge,
  isAuthenticated,
  canEdit,
}: {
  challenge: CtfChallengeDetail;
  isAuthenticated: boolean;
  canEdit: boolean;
}) {
  const t = useTranslations("ctf");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <Link
          href="/probleme?tab=ctf"
          className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("backToCtf")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight">{challenge.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="muted">{t(`category.${challenge.category}`)}</Badge>
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
              {challenge.solved_by_user && (
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                  {t("solvedYes")}
                </span>
              )}
            </div>
          </div>
          {canEdit && (
            <Link
              href={`/ctf/${challenge.slug}/editeaza` as Parameters<typeof Link>[0]["href"]}
              className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" aria-hidden="true" />
              {t("editChallenge")}
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <ProblemStatement markdown={challenge.statement_md} />

          {challenge.attachments.length > 0 && (
            <div>
              <Separator className="mb-4" />
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {t("attachments")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {challenge.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={`/api/ctf/${challenge.slug}/attachments/${att.id}/download`}
                    className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs transition-colors hover:border-foreground/30 hover:text-foreground"
                  >
                    <Download className="h-3.5 w-3.5" aria-hidden="true" />
                    {att.filename}
                  </a>
                ))}
              </div>
            </div>
          )}

          {challenge.hints.length > 0 && (
            <div>
              <Separator className="mb-4" />
              <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                {t("hints")}
              </h3>
              <div className="space-y-2">
                {challenge.hints.map((hint) => (
                  <HintRow key={hint.id} challengeSlug={challenge.slug} hint={hint} />
                ))}
              </div>
            </div>
          )}
        </div>

        <aside>
          <div className="rounded border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("submitFlag")}
            </p>
            <FlagSubmitForm
              slug={challenge.slug}
              alreadySolved={challenge.solved_by_user === true}
              isAuthenticated={isAuthenticated}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function HintRow({ challengeSlug, hint }: { challengeSlug: string; hint: CtfHint }) {
  const t = useTranslations("ctf");
  const queryClient = useQueryClient();
  const [revealing, setRevealing] = useState(false);
  const [open, setOpen] = useState(false);

  if (hint.revealed) {
    return (
      <div className="rounded border border-border p-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {t("hintNumber", { n: hint.ordinal + 1 })}
          </span>
          {hint.cost > 0 && (
            <span className="font-mono text-xs text-muted-foreground">
              -{hint.cost} {t("points")}
            </span>
          )}
        </div>
        <ProblemStatement markdown={hint.content_md ?? ""} className="text-xs" />
      </div>
    );
  }

  const handleReveal = async () => {
    setRevealing(true);
    try {
      await api.post(`/api/ctf/${challengeSlug}/hints/${hint.id}/reveal`, {});
      await queryClient.invalidateQueries({ queryKey: ["ctf-challenge", challengeSlug] });
      setOpen(false);
    } finally {
      setRevealing(false);
    }
  };

  return (
    <div className="flex items-center justify-between rounded border border-dashed border-border p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="h-3 w-3" aria-hidden="true" />
        {t("hintNumber", { n: hint.ordinal + 1 })}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button type="button" variant="outline" size="sm" className="h-7 text-xs">
            {hint.cost > 0 ? t("revealHintCost", { cost: hint.cost }) : t("revealHintFree")}
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("revealHintTitle")}</DialogTitle>
            <DialogDescription>
              {hint.cost > 0 ? t("revealHintConfirmCost", { cost: hint.cost }) : t("revealHintConfirmFree")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button type="button" onClick={handleReveal} disabled={revealing}>
              {revealing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("revealHintConfirmAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FlagSubmitForm({
  slug,
  alreadySolved,
  isAuthenticated,
}: {
  slug: string;
  alreadySolved: boolean;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("ctf");
  const queryClient = useQueryClient();
  const [flag, setFlag] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "correct" | "wrong" | "cooldown"; message: string; points?: number | null } | null
  >(null);

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

  if (alreadySolved) {
    return (
      <div className="flex items-center gap-2 rounded border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {t("alreadySolved")}
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flag.trim()) return;
    setSubmitting(true);
    setFeedback(null);
    try {
      const result = await api.post(
        `/api/ctf/${slug}/submit-flag`,
        { flag },
        CtfFlagSubmitResultSchema,
      );
      if (result.correct) {
        setFeedback({
          kind: "correct",
          message: result.first_blood ? t("firstBloodMessage") : t("correctMessage"),
          points: result.points_awarded,
        });
        await queryClient.invalidateQueries({ queryKey: ["ctf-challenge", slug] });
        await queryClient.invalidateQueries({ queryKey: ["ctf-challenges"] });
      } else {
        setFeedback({ kind: "wrong", message: t("wrongMessage") });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        setFeedback({ kind: "cooldown", message: err.detail });
      } else {
        setFeedback({ kind: "wrong", message: t("errorGeneric") });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <Input
        value={flag}
        onChange={(e) => setFlag(e.target.value)}
        placeholder={t("flagPlaceholder")}
        disabled={submitting}
        className="font-mono text-sm"
        autoComplete="off"
        spellCheck={false}
      />
      <Button type="submit" className="w-full gap-2" size="sm" disabled={submitting || !flag.trim()}>
        {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        {t("submitFlag")}
      </Button>

      {feedback && (
        <div
          className={cn(
            "rounded border px-3 py-2 text-xs",
            feedback.kind === "correct" && "border-success/30 bg-success/5 text-success",
            feedback.kind === "wrong" && "border-destructive/30 bg-destructive/5 text-destructive",
            feedback.kind === "cooldown" && "border-warning/30 bg-warning/5 text-warning",
          )}
        >
          {feedback.message}
          {feedback.kind === "correct" && feedback.points != null && (
            <span className="ml-1 font-mono font-semibold">
              (+{feedback.points} {t("points")})
            </span>
          )}
        </div>
      )}
    </form>
  );
}
