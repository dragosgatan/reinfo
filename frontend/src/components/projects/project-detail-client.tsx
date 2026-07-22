"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  Github,
  Loader2,
  Send,
  Star,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ProjectDetailSchema, ProjectSubmissionListResponseSchema } from "@/lib/types";
import type { ProjectSubmission } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
}

export function ProjectDetailClient({ slug }: Props) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const { user, isAuthenticated } = useAuth();

  const {
    data: project,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["project", slug],
    queryFn: () => api.get(`/api/projects/${slug}`, ProjectDetailSchema),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (isLoading) return null;

  if (error || !project) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Link href="/proiecte" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToProjects")}
        </Link>
      </div>
    );
  }

  const canEdit = user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";
  const deadlinePassed = project.deadline ? new Date(project.deadline) < new Date() : false;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/proiecte"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("backToProjects")}
      </Link>

      <div className="mb-2">
        <h1 className="text-xl font-bold tracking-tight">{project.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {project.class_name ? (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {project.class_name}
            </span>
          ) : (
            <Badge variant="muted">{t("publicProject")}</Badge>
          )}
          {project.deadline && (
            <span className={cn(deadlinePassed && "text-destructive")}>
              {t("deadline")}: {new Date(project.deadline).toLocaleString(locale)}
              {deadlinePassed && ` (${t("deadlinePassed")})`}
            </span>
          )}
        </div>
      </div>

      <Separator className="my-4" />
      <MarkdownContent markdown={project.brief_md} />

      <Separator className="my-5" />

      {canEdit ? (
        <TeacherSubmissions slug={slug} />
      ) : (
        <StudentSubmitForm
          slug={slug}
          mySubmission={project.my_submission ?? null}
          deadlinePassed={deadlinePassed}
          isAuthenticated={isAuthenticated}
        />
      )}
    </div>
  );
}

function StudentSubmitForm({
  slug,
  mySubmission,
  deadlinePassed,
  isAuthenticated,
}: {
  slug: string;
  mySubmission: ProjectSubmission | null;
  deadlinePassed: boolean;
  isAuthenticated: boolean;
}) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [repoUrl, setRepoUrl] = useState(mySubmission?.repo_url ?? "");
  const [notes, setNotes] = useState(mySubmission?.notes_md ?? "");
  const [submitting, setSubmitting] = useState(false);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!repoUrl.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/api/projects/${slug}/submissions`, {
        repo_url: repoUrl,
        notes_md: notes || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["project", slug] });
      toast.success(t("submitSuccess"));
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 422
          ? t("invalidRepoUrl")
          : err instanceof ApiError && err.status === 400
            ? t("deadlinePassed")
            : t("errorGeneric"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {mySubmission ? t("yourSubmission") : t("submitProject")}
      </p>

      {mySubmission?.grade && (
        <div className="rounded border border-success/30 bg-success/5 p-3">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-medium text-success">{t("graded")}</span>
            {mySubmission.grade.score != null && (
              <span className="font-mono text-sm font-semibold">{mySubmission.grade.score}/100</span>
            )}
          </div>
          {mySubmission.grade.feedback_md && (
            <MarkdownContent markdown={mySubmission.grade.feedback_md} className="text-xs" />
          )}
        </div>
      )}

      {deadlinePassed && !mySubmission && (
        <p className="text-sm text-destructive">{t("deadlinePassedNoSubmission")}</p>
      )}

      {(!deadlinePassed || mySubmission) && (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="repo_url">{t("repoUrlLabel")}</Label>
            <Input
              id="repo_url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              disabled={deadlinePassed}
              className="font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="notes_md">{t("notesLabel")}</Label>
            <textarea
              id="notes_md"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={deadlinePassed}
              rows={4}
              className="w-full rounded border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder={t("notesPlaceholder")}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            className="gap-2"
            disabled={submitting || deadlinePassed || !repoUrl.trim()}
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {mySubmission ? t("resubmit") : t("submit")}
          </Button>
          {mySubmission && (
            <p className="text-[11px] text-muted-foreground">
              {t("lastUpdated")}: {new Date(mySubmission.last_updated_at).toLocaleString(locale)}
            </p>
          )}
        </form>
      )}
    </div>
  );
}

function TeacherSubmissions({ slug }: { slug: string }) {
  const t = useTranslations("projects");
  const { data, isLoading } = useQuery({
    queryKey: ["project-submissions", slug],
    queryFn: () =>
      api.get(`/api/projects/${slug}/submissions`, ProjectSubmissionListResponseSchema),
  });

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("submissions")}
      </p>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {!isLoading && (data?.items.length ?? 0) === 0 && (
        <p className="text-sm text-muted-foreground">{t("noSubmissionsYet")}</p>
      )}
      <div className="space-y-3">
        {data?.items.map((submission) => (
          <SubmissionRow key={submission.id} slug={slug} submission={submission} />
        ))}
      </div>
    </div>
  );
}

function SubmissionRow({
  slug,
  submission,
}: {
  slug: string;
  submission: ProjectSubmission;
}) {
  const t = useTranslations("projects");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [score, setScore] = useState(submission.grade?.score?.toString() ?? "");
  const [feedback, setFeedback] = useState(submission.grade?.feedback_md ?? "");
  const [saving, setSaving] = useState(false);

  async function handleGrade() {
    setSaving(true);
    try {
      await api.post(`/api/projects/${slug}/submissions/${submission.id}/grade`, {
        score: score ? Number(score) : null,
        feedback_md: feedback || null,
      });
      await queryClient.invalidateQueries({ queryKey: ["project-submissions", slug] });
      toast.success(t("gradeSaved"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-border p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <Link
          href={`/u/${submission.student_username}` as Parameters<typeof Link>[0]["href"]}
          className="text-sm font-medium hover:text-primary"
        >
          {submission.student_username}
        </Link>
        <a
          href={submission.repo_url}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <Github className="h-3.5 w-3.5" aria-hidden="true" />
          {submission.repo_url.replace("https://github.com/", "")}
        </a>
      </div>

      {submission.repo_info && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          {submission.repo_info.ok ? (
            <>
              {submission.repo_info.language && <span>{submission.repo_info.language}</span>}
              {submission.repo_info.stars != null && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3" aria-hidden="true" />
                  {submission.repo_info.stars}
                </span>
              )}
              {submission.repo_info.commit_count_approx != null && (
                <span>~{submission.repo_info.commit_count_approx} {t("commits")}</span>
              )}
              {submission.repo_info.last_commit_at && (
                <span>
                  {t("lastCommit")}:{" "}
                  {new Date(submission.repo_info.last_commit_at).toLocaleDateString(locale)}
                </span>
              )}
            </>
          ) : (
            <span>{t("repoInfoUnavailable")}</span>
          )}
        </div>
      )}

      {submission.notes_md && (
        <div className="mb-2">
          <MarkdownContent markdown={submission.notes_md} className="text-xs" />
        </div>
      )}

      <p className="mb-2 text-[11px] text-muted-foreground">
        {t("submittedAt")}: {new Date(submission.submitted_at).toLocaleString(locale)}
      </p>

      <div className="grid gap-2 sm:grid-cols-[100px_1fr_auto]">
        <Input
          type="number"
          min={0}
          max={100}
          value={score}
          onChange={(e) => setScore(e.target.value)}
          placeholder={t("scoreLabel")}
          className="h-8 text-sm"
        />
        <Input
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder={t("feedbackPlaceholder")}
          className="h-8 text-sm"
        />
        <Button type="button" size="sm" className="h-8" onClick={handleGrade} disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("grade")}
        </Button>
      </div>
    </div>
  );
}
