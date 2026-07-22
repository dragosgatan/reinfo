"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import type { UseFormSetValue, UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Trash2, Upload, X, ArrowLeft, Languages } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import {
  ProblemReadSchema,
  TestCaseListSchema,
  DatasetFilesStatusSchema,
  DATASET_METRIC_LABELS,
  ALL_TAGS,
  getTagLabel,
} from "@/lib/types";
import type { DatasetFilesStatus } from "@/lib/types";
import { getDifficultyLabel } from "@/components/problems/difficulty-indicator";
import type { TestCaseRead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(256),
  difficulty: z.coerce.number().int().min(1).max(10),
  statement_md: z.string().min(1, "Statement (Romanian) is required"),
  statement_md_en: z.string().default(""),
  statement_md_hu: z.string().default(""),
  input_format: z.string().default(""),
  output_format: z.string().default(""),
  time_limit_ms: z.coerce.number().int().min(100).max(30000),
  memory_limit_kb: z.coerce.number().int().min(4096).max(524288),
  comparison_mode: z.enum(["exact", "whitespace_insensitive", "float_epsilon"]),
  float_epsilon: z.coerce.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(["draft", "public", "private", "contest"]),
  dataset_metric: z.enum(["accuracy", "f1", "rmse", "mae"]).default("accuracy"),
  metric_threshold: z.coerce.number().optional().nullable(),
  dataset_id_column: z.string().default("id"),
  dataset_target_column: z.string().default("target"),
  dataset_expected_rows: z.coerce.number().int().optional().nullable(),
  require_source_in_contest: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

export default function EditProblemPage() {
  const t = useTranslations("problems");
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [statementLang, setStatementLang] = useState<"ro" | "en" | "hu">("ro");
  const [translating, setTranslating] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchStatement = watch("statement_md");
  const watchStatementEn = watch("statement_md_en");
  const watchStatementHu = watch("statement_md_hu");
  const watchTags = watch("tags");
  const watchComparisonMode = watch("comparison_mode");
  const watchVisibility = watch("visibility");
  const watchMetric = watch("dataset_metric");

  const [problemType, setProblemType] = useState<string | null>(null);
  const [datasetFilesStatus, setDatasetFilesStatus] = useState<DatasetFilesStatus | null>(null);
  const [datasetFiles, setDatasetFiles] = useState<{
    train_csv: File | null;
    test_csv: File | null;
    sample_submission_csv: File | null;
    answer_csv: File | null;
  }>({ train_csv: null, test_csv: null, sample_submission_csv: null, answer_csv: null });

  useEffect(() => {
    if (authLoading) return;
    if (
      !user ||
      (user.role !== "teacher" && user.role !== "admin" && user.role !== "superuser")
    )
      return;

    api.get(`/api/problems/${slug}`, ProblemReadSchema)
      .then((problem) => {
        reset({
          title: problem.title,
          difficulty: problem.difficulty,
          statement_md: problem.statement_md,
          statement_md_en: problem.statement_md_en ?? "",
          statement_md_hu: problem.statement_md_hu ?? "",
          input_format: problem.input_format ?? "",
          output_format: problem.output_format ?? "",
          time_limit_ms: problem.time_limit_ms,
          memory_limit_kb: problem.memory_limit_kb,
          comparison_mode: problem.comparison_mode as FormValues["comparison_mode"],
          float_epsilon: problem.float_epsilon ?? null,
          tags: problem.tags,
          visibility: problem.visibility as FormValues["visibility"],
          dataset_metric: (problem.dataset_metric ?? "accuracy") as FormValues["dataset_metric"],
          metric_threshold: problem.metric_threshold ?? null,
          dataset_id_column: problem.dataset_id_column ?? "id",
          dataset_target_column: problem.dataset_target_column ?? "target",
          dataset_expected_rows: problem.dataset_expected_rows ?? null,
          require_source_in_contest: problem.require_source_in_contest ?? true,
        });
        setProblemType(problem.problem_type);
        setLoaded(true);

        if (problem.problem_type === "dataset") {
          api
            .get(`/api/problems/${slug}/dataset-files`, DatasetFilesStatusSchema)
            .then(setDatasetFilesStatus)
            .catch(() => {});
        }
      })
      .catch(() => setLoadError(t("loadErrorProblem")));
  }, [authLoading, user, slug, reset, t]);

  const toggleTag = useCallback(
    (tag: string) => {
      const current = watchTags ?? [];
      setValue(
        "tags",
        current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      );
    },
    [watchTags, setValue],
  );

  const handleTranslate = useCallback(async () => {
    const sourceText =
      statementLang === "ro"
        ? watchStatement
        : statementLang === "en"
          ? watchStatementEn
          : watchStatementHu;

    if (!sourceText?.trim()) {
      toast.error(t("translateErrorEmpty"));
      return;
    }

    const targetLangs = (["ro", "en", "hu"] as const).filter((l) => l !== statementLang);

    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, sourceLang: statementLang, targetLangs }),
      });
      const data = await res.json() as { results?: Record<string, string>; error?: string; model?: string };

      if (!res.ok || data.error) {
        toast.error(data.error ?? t("translateErrorFailed"));
        return;
      }

      const results = data.results ?? {};
      if (results.ro !== undefined) setValue("statement_md", results.ro);
      if (results.en !== undefined) setValue("statement_md_en", results.en);
      if (results.hu !== undefined) setValue("statement_md_hu", results.hu);

      const modelShort = (data.model ?? "").split("/").pop()?.replace(":free", "") ?? "";
      const langs = targetLangs.map((l) => l.toUpperCase()).join(", ");
      toast.success(`${t("translatedTo", { langs })}${modelShort ? ` · ${modelShort}` : ""}`);
    } catch {
      toast.error(t("translateErrorGeneric"));
    } finally {
      setTranslating(false);
    }
  }, [statementLang, watchStatement, watchStatementEn, watchStatementHu, setValue, t]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        const isDataset = problemType === "dataset";
        await api.patch(
          `/api/problems/${slug}`,
          {
            title: values.title,
            statement_md: values.statement_md,
            statement_md_en: values.statement_md_en || null,
            statement_md_hu: values.statement_md_hu || null,
            input_format: values.input_format ?? "",
            output_format: values.output_format ?? "",
            difficulty: values.difficulty,
            tags: values.tags,
            visibility: values.visibility,
            time_limit_ms: values.time_limit_ms,
            memory_limit_kb: values.memory_limit_kb,
            comparison_mode: values.comparison_mode,
            float_epsilon:
              values.comparison_mode === "float_epsilon" ? values.float_epsilon : null,
            ...(isDataset && {
              dataset_metric: values.dataset_metric,
              metric_threshold: values.metric_threshold,
              dataset_id_column: values.dataset_id_column,
              dataset_target_column: values.dataset_target_column,
              dataset_expected_rows: values.dataset_expected_rows,
              require_source_in_contest: values.require_source_in_contest,
            }),
          },
          ProblemReadSchema,
        );

        if (isDataset && Object.values(datasetFiles).some((f) => f !== null)) {
          const formData = new FormData();
          if (datasetFiles.train_csv) formData.append("train_csv", datasetFiles.train_csv);
          if (datasetFiles.test_csv) formData.append("test_csv", datasetFiles.test_csv);
          if (datasetFiles.sample_submission_csv) {
            formData.append("sample_submission_csv", datasetFiles.sample_submission_csv);
          }
          if (datasetFiles.answer_csv) formData.append("answer_csv", datasetFiles.answer_csv);

          const res = await fetch(`/api/problems/${slug}/dataset-files`, {
            method: "POST",
            credentials: "include",
            body: formData,
          });
          if (!res.ok) {
            const payload = await res.json().catch(() => ({}));
            throw new Error((payload as { detail?: string }).detail ?? t("errorGeneric"));
          }
        }

        toast.success(t("changesSaved"));
        router.push(`/probleme/${slug}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      } finally {
        setSubmitting(false);
      }
    },
    [slug, router, t, problemType, datasetFiles],
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/problems/${slug}`);
      await queryClient.invalidateQueries({ queryKey: ["problems"] });
      toast.success(t("problemDeleted"));
      router.push("/probleme");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [slug, router, queryClient, t]);

  if (authLoading) return null;

  if (
    !user ||
    (user.role !== "teacher" && user.role !== "admin" && user.role !== "superuser")
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{t("accessDeniedProblem")}</p>
        <Link href={`/probleme/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToProblemLink")}
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Link href={`/probleme/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToProblemLink")}
        </Link>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/probleme/${slug}`}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            {t("backToProblemLink")}
          </Link>
          <h1 className="text-xl font-bold tracking-tight">{t("editProblemTitle")}</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("saveChanges")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`/probleme/${slug}`)}
            aria-label={t("closeLabel")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">{t("titleLabel")}</Label>
            <Input
              id="title"
              {...register("title")}
              className={cn(errors.title && "border-destructive")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>{t("statement")}</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
                  title={t("translateFrom", { lang: statementLang.toUpperCase() })}
                >
                  {translating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Languages className="h-3 w-3" />
                  )}
                  {t("translateFrom", { lang: statementLang.toUpperCase() })}
                </button>
                <div className="flex rounded border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setStatementLang("ro")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      statementLang === "ro"
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    RO
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementLang("en")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      statementLang === "en"
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementLang("hu")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      statementLang === "hu"
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    HU
                  </button>
                </div>
              </div>
            </div>
            <Tabs defaultValue="edit">
              <TabsList className="mb-2">
                <TabsTrigger value="edit">
                  <EyeOff className="mr-1.5 h-3 w-3" />
                  {t("editTab")}
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="mr-1.5 h-3 w-3" />
                  {t("previewTab")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <div className={cn(statementLang !== "ro" && "hidden")}>
                  <textarea
                    {...register("statement_md")}
                    rows={10}
                    className={cn(
                      "w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                      errors.statement_md && "border-destructive",
                    )}
                  />
                  {errors.statement_md && (
                    <p className="mt-1 text-xs text-destructive">{errors.statement_md.message}</p>
                  )}
                </div>
                <div className={cn(statementLang !== "en" && "hidden")}>
                  <textarea
                    {...register("statement_md_en")}
                    rows={10}
                    placeholder="Problem statement in English (Markdown + LaTeX). Optional."
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className={cn(statementLang !== "hu" && "hidden")}>
                  <textarea
                    {...register("statement_md_hu")}
                    rows={10}
                    placeholder="A feladat szövege magyarul (Markdown + LaTeX). Opcionális."
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview">
                {(statementLang === "ro" ? watchStatement : statementLang === "en" ? watchStatementEn : watchStatementHu) ? (
                  <div className="min-h-[200px] rounded border border-border p-4">
                    <MarkdownContent
                      markdown={(statementLang === "ro" ? watchStatement : statementLang === "en" ? watchStatementEn : watchStatementHu) ?? ""}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center rounded border border-border text-sm text-muted-foreground">
                    {t("previewPlaceholder")}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {problemType !== "dataset" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="input_format">{t("inputFormatLabel")}</Label>
                <textarea
                  id="input_format"
                  {...register("input_format")}
                  rows={4}
                  className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="output_format">{t("outputFormatLabel")}</Label>
                <textarea
                  id="output_format"
                  {...register("output_format")}
                  rows={4}
                  className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}

          {problemType === "dataset" && (
            <>
              <Separator />
              <DatasetEditFields
                register={register}
                setValue={setValue}
                metric={watchMetric}
                filesStatus={datasetFilesStatus}
                datasetFiles={datasetFiles}
                setDatasetFiles={setDatasetFiles}
              />
            </>
          )}
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("difficulty")}</Label>
            <Select
              value={String(watch("difficulty") ?? 3)}
              onValueChange={(v) => setValue("difficulty", Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {i + 1} -{" "}
                    {getDifficultyLabel(i + 1, t as (key: string) => string)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="time_limit_ms" className="text-xs">{t("timeLimitLabel")}</Label>
              <Input
                id="time_limit_ms"
                type="number"
                {...register("time_limit_ms")}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="memory_limit_kb" className="text-xs">{t("memoryLimitLabel")}</Label>
              <Input
                id="memory_limit_kb"
                type="number"
                {...register("memory_limit_kb")}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("comparisonModeLabel")}</Label>
            <Select
              value={watchComparisonMode ?? "exact"}
              onValueChange={(v) => setValue("comparison_mode", v as FormValues["comparison_mode"])}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t("comparisonExact")}</SelectItem>
                <SelectItem value="whitespace_insensitive">{t("comparisonWhitespace")}</SelectItem>
                <SelectItem value="float_epsilon">{t("comparisonFloat")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watchComparisonMode === "float_epsilon" && (
            <div className="space-y-1.5">
              <Label htmlFor="float_epsilon" className="text-xs">{t("epsilonLabel")}</Label>
              <Input
                id="float_epsilon"
                type="number"
                step="any"
                placeholder="0.001"
                {...register("float_epsilon")}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>{t("visibilityLabel")}</Label>
            {watchVisibility === "contest" ? (
              <div className="rounded border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                {t("visibilityContest")}
              </div>
            ) : (
              <Select
                value={watchVisibility ?? "draft"}
                onValueChange={(v) => setValue("visibility", v as FormValues["visibility"])}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("visibilityDraft")}</SelectItem>
                  <SelectItem value="public">{t("visibilityPublic")}</SelectItem>
                  <SelectItem value="private">{t("visibilityPrivate")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {(user?.role === "admin" || user?.role === "superuser") && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-destructive/70">
                  {t("dangerZone")}
                </p>
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      {t("deleteProblem")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>{t("deleteProblem")}</DialogTitle>
                      <DialogDescription>
                        {t("deleteConfirmation")}
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleting}
                      >
                        {t("cancelDelete")}
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        {t("confirmDelete")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}

          <Separator />

          <div>
            <Label className="mb-2 block">{t("tagsLabel")}</Label>
            <div className="flex flex-wrap gap-1">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded border px-2 py-0.5 text-xs transition-colors",
                    (watchTags ?? []).includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {getTagLabel(tag, t as (key: string) => string)}
                </button>
              ))}
            </div>
            {(watchTags ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {watchTags!.map((tag) => (
                  <Badge key={tag} variant="default" className="text-xs">
                    {getTagLabel(tag, t as (key: string) => string)}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>

    {problemType !== "dataset" && problemType !== "quiz" && <TestCaseManager slug={slug} />}
    </>
  );
}

interface DatasetFilesState {
  train_csv: File | null;
  test_csv: File | null;
  sample_submission_csv: File | null;
  answer_csv: File | null;
}

function DatasetEditFields({
  register,
  setValue,
  metric,
  filesStatus,
  datasetFiles,
  setDatasetFiles,
}: {
  register: UseFormRegister<FormValues>;
  setValue: UseFormSetValue<FormValues>;
  metric: FormValues["dataset_metric"];
  filesStatus: DatasetFilesStatus | null;
  datasetFiles: DatasetFilesState;
  setDatasetFiles: (files: DatasetFilesState) => void;
}) {
  const t = useTranslations("problems");

  const fileFields: { key: keyof DatasetFilesState; label: string; uploaded?: boolean }[] = [
    { key: "train_csv", label: t("datasetFileTrain"), uploaded: filesStatus?.train_csv },
    { key: "test_csv", label: t("datasetFileTest"), uploaded: filesStatus?.test_csv },
    {
      key: "sample_submission_csv",
      label: t("datasetFileSampleSubmission"),
      uploaded: filesStatus?.sample_submission_csv,
    },
    { key: "answer_csv", label: t("datasetFileAnswer"), uploaded: filesStatus?.answer_csv },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("datasetMetricLabel")}</Label>
          <Select
            value={metric}
            onValueChange={(v) => setValue("dataset_metric", v as FormValues["dataset_metric"])}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="accuracy">{DATASET_METRIC_LABELS.accuracy}</SelectItem>
              <SelectItem value="f1">{DATASET_METRIC_LABELS.f1}</SelectItem>
              <SelectItem value="rmse">{DATASET_METRIC_LABELS.rmse}</SelectItem>
              <SelectItem value="mae">{DATASET_METRIC_LABELS.mae}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="metric_threshold">
            {t("datasetThresholdLabel")}
            {(metric === "rmse" || metric === "mae") && (
              <span className="ml-1 text-destructive">*</span>
            )}
          </Label>
          <Input
            id="metric_threshold"
            type="number"
            step="any"
            {...register("metric_threshold")}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dataset_id_column">{t("datasetIdColumnLabel")}</Label>
          <Input id="dataset_id_column" {...register("dataset_id_column")} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dataset_target_column">{t("datasetTargetColumnLabel")}</Label>
          <Input
            id="dataset_target_column"
            {...register("dataset_target_column")}
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="dataset_expected_rows">{t("datasetExpectedRowsLabel")}</Label>
          <Input
            id="dataset_expected_rows"
            type="number"
            {...register("dataset_expected_rows")}
            className="h-9"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          {...register("require_source_in_contest")}
          className="h-3.5 w-3.5 rounded border-border"
        />
        {t("datasetRequireSourceLabel")}
      </label>

      <Separator />

      <div>
        <Label className="mb-2 block">{t("datasetFilesLabel")}</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {fileFields.map(({ key, label, uploaded }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`dataset-file-${key}`} className="text-xs text-muted-foreground">
                {label} {uploaded ? "✓" : ""}
              </Label>
              <input
                id={`dataset-file-${key}`}
                type="file"
                accept=".csv"
                onChange={(e) =>
                  setDatasetFiles({ ...datasetFiles, [key]: e.target.files?.[0] ?? null })
                }
                className="block w-full text-xs file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TestCaseManager({ slug }: { slug: string }) {
  const t = useTranslations("problems");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deletingOrdinal, setDeletingOrdinal] = useState<number | null>(null);
  const [mode, setMode] = useState<"text" | "file">("text");
  const inRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLInputElement>(null);
  const [inText, setInText] = useState("");
  const [outText, setOutText] = useState("");
  const [ordinal, setOrdinal] = useState("");
  const [score, setScore] = useState("10");
  const [isSample, setIsSample] = useState(false);

  const { data: testCases, isLoading } = useQuery({
    queryKey: ["test-cases", slug],
    queryFn: () => api.get(`/api/problems/${slug}/test-cases`, TestCaseListSchema),
    staleTime: 0,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["test-cases", slug] }),
    [queryClient, slug],
  );

  const handleDelete = useCallback(
    async (tc: TestCaseRead) => {
      setDeletingOrdinal(tc.ordinal);
      try {
        await api.delete(`/api/problems/${slug}/test-cases/${tc.ordinal}`);
        await invalidate();
        toast.success(t("tcDeleted", { n: tc.ordinal }));
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      } finally {
        setDeletingOrdinal(null);
      }
    },
    [slug, invalidate, t],
  );

  const submitFormData = useCallback(
    async (fd: FormData) => {
      const r = await fetch(`/api/problems/${slug}/test-cases`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) {
        const payload = await r.json().catch(() => ({}));
        throw new ApiError(r.status, (payload as { detail?: string }).detail ?? r.statusText);
      }
    },
    [slug],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (ordinal === "") {
        toast.error(t("tcOrdinalMissing"));
        return;
      }

      let inBlob: Blob;
      let outBlob: Blob;

      if (mode === "text") {
        if (!inText.trim() && !outText.trim()) {
          toast.error(t("tcFillData"));
          return;
        }
        inBlob = new Blob([inText], { type: "text/plain" });
        outBlob = new Blob([outText], { type: "text/plain" });
      } else {
        const inFile = inRef.current?.files?.[0];
        const outFile = outRef.current?.files?.[0];
        if (!inFile || !outFile) {
          toast.error(t("tcSelectFiles"));
          return;
        }
        inBlob = inFile;
        outBlob = outFile;
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("ordinal", ordinal);
        fd.append("score", score);
        fd.append("is_sample", String(isSample));
        fd.append("is_hidden", String(!isSample));
        fd.append("input_file", inBlob, `${ordinal}.in`);
        fd.append("output_file", outBlob, `${ordinal}.out`);
        await submitFormData(fd);
        await invalidate();
        toast.success(t("tcAdded", { n: ordinal }));
        setOrdinal("");
        setScore("10");
        setIsSample(false);
        setInText("");
        setOutText("");
        if (inRef.current) inRef.current.value = "";
        if (outRef.current) outRef.current.value = "";
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      } finally {
        setUploading(false);
      }
    },
    [mode, inText, outText, ordinal, score, isSample, invalidate, submitFormData, t],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <Separator className="my-8" />
      <h2 className="mb-4 text-base font-semibold tracking-tight">{t("testCasesSection")}</h2>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{tCommon("loading")}</p>
      ) : testCases && testCases.length > 0 ? (
        <div className="mb-6 overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("scoreLabel")}</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t("typeLabel")}</th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc) => (
                <tr key={tc.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono">{tc.ordinal}</td>
                  <td className="px-3 py-2 font-mono">{tc.score}p</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {tc.is_sample ? t("tcSampleLabel") : t("outputHidden")}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(tc)}
                      disabled={deletingOrdinal === tc.ordinal}
                      className="flex items-center text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                      aria-label={t("tcDeleted", { n: tc.ordinal })}
                    >
                      {deletingOrdinal === tc.ordinal ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-6 text-xs text-muted-foreground">{t("noTestCasesAdded")}</p>
      )}

      <form onSubmit={handleSubmit} className="rounded border border-border p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("addTestCase")}
          </p>
          <div className="flex rounded border border-border text-xs">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={cn("px-2.5 py-1 transition-colors", mode === "text" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {t("textMode")}
            </button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cn("px-2.5 py-1 transition-colors", mode === "file" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              {t("fileMode")}
            </button>
          </div>
        </div>

        {mode === "text" ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("tcInputData")}</Label>
              <textarea
                value={inText}
                onChange={(e) => setInText(e.target.value)}
                rows={5}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="1 2 3"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("tcOutputData")}</Label>
              <textarea
                value={outText}
                onChange={(e) => setOutText(e.target.value)}
                rows={5}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="6"
              />
            </div>
          </div>
        ) : (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">{t("tcFileIn")}</Label>
              <input ref={inRef} type="file" accept=".in,text/*" className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("tcFileOut")}</Label>
              <input ref={outRef} type="file" accept=".out,text/*" className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="tc-ordinal" className="text-xs">Ordinal</Label>
            <Input id="tc-ordinal" type="number" min={0} value={ordinal} onChange={(e) => setOrdinal(e.target.value)} className="h-8 w-24 text-sm" placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tc-score" className="text-xs">{t("scoreLabel")}</Label>
            <Input id="tc-score" type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} className="h-8 w-20 text-sm" />
          </div>
          <label className="flex items-center gap-1.5 pb-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} className="h-3 w-3" />
            {t("tcSampleLabel")}
          </label>
          <Button type="submit" size="sm" disabled={uploading} className="h-8">
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            {t("addProblem")}
          </Button>
        </div>
      </form>
    </div>
  );
}
