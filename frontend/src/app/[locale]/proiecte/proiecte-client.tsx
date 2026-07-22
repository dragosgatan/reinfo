"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { ChevronRight, FolderKanban, Loader2, Plus, Users } from "lucide-react";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ClassReadSchema, ProjectListResponseSchema } from "@/lib/types";
import type { ClassRead, ProjectSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 128);
}

export default function ProiecteClient() {
  const t = useTranslations("projects");
  const locale = useLocale();
  const { user } = useAuth();
  const canAuthor = user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get("/api/projects", ProjectListResponseSchema),
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-16 text-center text-muted-foreground">
        {t("noProjects")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canAuthor && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("addProject")}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t("noProjects")}</p>
      ) : (
        <div className="space-y-3">
          {(data?.items ?? []).map((project) => (
            <ProjectCard key={project.id} project={project} canAuthor={canAuthor} locale={locale} />
          ))}
        </div>
      )}

      <CreateProjectDialog
        open={showCreate}
        onClose={(slug) => {
          setShowCreate(false);
          if (slug) router.push(`/proiecte/${slug}`);
        }}
      />
    </div>
  );
}

function ProjectCard({
  project,
  canAuthor,
  locale,
}: {
  project: ProjectSummary;
  canAuthor: boolean;
  locale: string;
}) {
  const t = useTranslations("projects");
  const deadlinePassed = project.deadline ? new Date(project.deadline) < new Date() : false;

  return (
    <Link
      href={`/proiecte/${project.slug}` as Parameters<typeof Link>[0]["href"]}
      className={cn(
        "group flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-all",
        "hover:border-foreground/20 hover:shadow-sm",
        !project.published && "opacity-60",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium leading-snug">{project.title}</span>
          {canAuthor && !project.published && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("draft")}
            </span>
          )}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {project.class_name ? (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" aria-hidden="true" />
              {project.class_name}
            </span>
          ) : (
            <span>{t("publicProject")}</span>
          )}
          {project.deadline && (
            <span className={cn(deadlinePassed && "text-destructive")}>
              {t("deadline")}: {new Date(project.deadline).toLocaleDateString(locale)}
            </span>
          )}
          {canAuthor && (
            <span>
              {project.submission_count} {t("submissions")}
            </span>
          )}
          {project.my_submission_id && (
            <Badge variant="success" className="text-[10px]">
              {t("submitted")}
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

function CreateProjectDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (slug?: string) => void;
}) {
  const t = useTranslations("projects");
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [classId, setClassId] = useState<string>("none");
  const [submitting, setSubmitting] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get<ClassRead[]>("/api/classes", ClassReadSchema.array()),
    enabled: open,
  });
  const myClasses = (classes ?? []).filter((c) => c.teacher_id === user?.id);

  async function handleCreate() {
    if (!title.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      const project = await api.post<ProjectSummary>("/api/projects", {
        title,
        slug,
        brief_md: `# ${title}\n\n${t("briefPlaceholder")}`,
        class_id: classId === "none" ? null : classId,
        published: false,
      });
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setTitle("");
      setSlug("");
      setClassId("none");
      onClose(project.slug);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("addProject")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="project-title">{t("titleLabel")}</Label>
            <Input
              id="project-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug || slug === slugify(title)) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-slug">{t("slugLabel")}</Label>
            <Input
              id="project-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("classLabel")}</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("publicProject")}</SelectItem>
                {myClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose()}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
