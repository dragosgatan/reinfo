"use client";

import { useState, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import type { UseFormSetValue } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Eye, EyeOff, Loader2, X, Languages } from "lucide-react";
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
import { ProblemStatement } from "@/components/problems/problem-statement";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ProblemReadSchema, ALL_TAGS, DATASET_METRIC_LABELS, getTagLabel } from "@/lib/types";
import { getDifficultyLabel } from "@/components/problems/difficulty-indicator";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(256),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(128)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, digits and hyphens"),
  difficulty: z.coerce.number().int().min(1).max(10),
  problem_type: z.enum(["standard", "quiz", "dataset"]).default("standard"),
  dataset_metric: z.enum(["accuracy", "f1", "rmse", "mae"]).default("accuracy"),
  metric_threshold: z.coerce.number().optional().nullable(),
  dataset_id_column: z.string().default("id"),
  dataset_target_column: z.string().default("target"),
  dataset_expected_rows: z.coerce.number().int().optional().nullable(),
  require_source_in_contest: z.boolean().default(true),
  statement_md: z.string().min(1, "Statement (Romanian) is required"),
  statement_md_en: z.string().default(""),
  statement_md_hu: z.string().default(""),
  input_format: z.string().default(""),
  output_format: z.string().default(""),
  time_limit_ms: z.coerce.number().int().min(100).max(30000).default(1000),
  memory_limit_kb: z.coerce.number().int().min(4096).max(524288).default(65536),
  comparison_mode: z
    .enum(["exact", "whitespace_insensitive", "float_epsilon"])
    .default("exact"),
  float_epsilon: z.coerce.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  testCases: z
    .array(
      z.object({
        input_content: z.string().min(1, "Input required"),
        output_content: z.string().min(1, "Output required"),
        score: z.coerce.number().int().min(0).default(10),
        is_sample: z.boolean().default(false),
      }),
    )
    .default([]),
  quizOptions: z
    .array(
      z.object({
        text_md: z.string().min(1, "Option text is required"),
        is_correct: z.boolean().default(false),
        explanation_md: z.string().default(""),
      }),
    )
    .default([]),
});

type FormValues = z.infer<typeof schema>;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 128);
}

export default function NouProblemPage() {
  const t = useTranslations("problems");
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestSlug = searchParams.get("contest_slug");
  const { user, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [publishMode, setPublishMode] = useState<"draft" | "public">("draft");
  const [statementLang, setStatementLang] = useState<"ro" | "en" | "hu">("ro");
  const [translating, setTranslating] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      difficulty: 3,
      problem_type: "standard",
      time_limit_ms: 1000,
      memory_limit_kb: 65536,
      comparison_mode: "exact",
      tags: [],
      testCases: [],
      quizOptions: [],
      statement_md_en: "",
      statement_md_hu: "",
      dataset_metric: "accuracy",
      dataset_id_column: "id",
      dataset_target_column: "target",
      require_source_in_contest: true,
    },
  });

  const [datasetFiles, setDatasetFiles] = useState<{
    train_csv: File | null;
    test_csv: File | null;
    sample_submission_csv: File | null;
    answer_csv: File | null;
  }>({ train_csv: null, test_csv: null, sample_submission_csv: null, answer_csv: null });

  const { fields: testCaseFields, append, remove } = useFieldArray({
    control,
    name: "testCases",
  });

  const {
    fields: quizOptionFields,
    append: appendQuizOption,
    remove: removeQuizOption,
  } = useFieldArray({ control, name: "quizOptions" });

  const watchTitle = watch("title");
  const watchSlug = watch("slug");
  const watchStatement = watch("statement_md");
  const watchStatementEn = watch("statement_md_en");
  const watchStatementHu = watch("statement_md_hu");
  const watchTags = watch("tags");
  const watchComparisonMode = watch("comparison_mode");
  const watchProblemType = watch("problem_type");

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const title = e.target.value;
      setValue("title", title);
      if (!watchSlug || watchSlug === slugify(watchTitle ?? "")) {
        setValue("slug", slugify(title));
      }
    },
    [setValue, watchSlug, watchTitle],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const current = watchTags ?? [];
      if (current.includes(tag)) {
        setValue(
          "tags",
          current.filter((t) => t !== tag),
        );
      } else {
        setValue("tags", [...current, tag]);
      }
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
        const visibility = contestSlug ? "contest" : publishMode === "public" ? "public" : "draft";

        const isQuiz = values.problem_type === "quiz";
        const isDataset = values.problem_type === "dataset";

        const problem = await api.post(
          "/api/problems/",
          {
            slug: values.slug,
            title: values.title,
            statement_md: values.statement_md,
            statement_md_en: values.statement_md_en || null,
            statement_md_hu: values.statement_md_hu || null,
            input_format: isQuiz || isDataset ? "" : (values.input_format ?? ""),
            output_format: isQuiz || isDataset ? "" : (values.output_format ?? ""),
            difficulty: values.difficulty,
            tags: values.tags,
            visibility,
            problem_type: values.problem_type,
            time_limit_ms: values.time_limit_ms,
            memory_limit_kb: values.memory_limit_kb,
            score_total:
              isQuiz || isDataset
                ? 100
                : values.testCases.reduce((sum, tc) => sum + (tc.score ?? 0), 0) || 100,
            comparison_mode: values.comparison_mode,
            float_epsilon:
              values.comparison_mode === "float_epsilon" ? values.float_epsilon : null,
            dataset_metric: isDataset ? values.dataset_metric : null,
            metric_threshold: isDataset ? values.metric_threshold : null,
            dataset_id_column: isDataset ? values.dataset_id_column : null,
            dataset_target_column: isDataset ? values.dataset_target_column : null,
            dataset_expected_rows: isDataset ? values.dataset_expected_rows : null,
            require_source_in_contest: isDataset ? values.require_source_in_contest : true,
          },
          ProblemReadSchema,
        );

        if (isQuiz && values.quizOptions.length > 0) {
          await api.put(
            `/api/problems/${problem.slug}/quiz-options`,
            values.quizOptions.map((opt, i) => ({
              ordinal: i,
              text_md: opt.text_md,
              is_correct: opt.is_correct,
              explanation_md: opt.explanation_md || null,
            })),
          );
        }

        if (isDataset) {
          const hasFiles = Object.values(datasetFiles).some((f) => f !== null);
          if (hasFiles) {
            const formData = new FormData();
            if (datasetFiles.train_csv) formData.append("train_csv", datasetFiles.train_csv);
            if (datasetFiles.test_csv) formData.append("test_csv", datasetFiles.test_csv);
            if (datasetFiles.sample_submission_csv) {
              formData.append("sample_submission_csv", datasetFiles.sample_submission_csv);
            }
            if (datasetFiles.answer_csv) formData.append("answer_csv", datasetFiles.answer_csv);

            const res = await fetch(`/api/problems/${problem.slug}/dataset-files`, {
              method: "POST",
              credentials: "include",
              body: formData,
            });
            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              throw new Error((payload as { detail?: string }).detail ?? t("errorGeneric"));
            }
          }
        }

        if (!isQuiz && !isDataset) {
          for (let i = 0; i < values.testCases.length; i++) {
            const tc = values.testCases[i];
            const formData = new FormData();
            formData.append("ordinal", String(i));
            formData.append("score", String(tc.score));
            formData.append("is_sample", String(tc.is_sample));
            formData.append("is_hidden", String(!tc.is_sample));
            formData.append(
              "input_file",
              new Blob([tc.input_content], { type: "text/plain" }),
              `${i}.in`,
            );
            formData.append(
              "output_file",
              new Blob([tc.output_content], { type: "text/plain" }),
              `${i}.out`,
            );

            const res = await fetch(`/api/problems/${problem.slug}/test-cases`, {
              method: "POST",
              credentials: "include",
              body: formData,
            });

            if (!res.ok) {
              const payload = await res.json().catch(() => ({}));
              throw new Error(
                `Test ${i + 1}: ${(payload as { detail?: string }).detail ?? "Eroare"}`,
              );
            }
          }
        }

        if (contestSlug) {
          await api.post(
            `/api/contests/${contestSlug}/problems?problem_slug=${problem.slug}`,
            {},
          );
          toast.success(t("addedToContest"));
          router.push(`/concursuri/${contestSlug}`);
        } else {
          toast.success(publishMode === "public" ? t("problemPublished") : t("draftSaved"));
          router.push(`/probleme/${problem.slug}`);
        }
      } catch (err) {
        const msg =
          err instanceof ApiError && err.status === 409
            ? t("slugConflict")
            : err instanceof Error
              ? err.message
              : t("errorGeneric");
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [publishMode, contestSlug, router, t, datasetFiles],
  );

  if (isLoading) return null;

  if (
    !user ||
    (user.role !== "teacher" && user.role !== "admin" && user.role !== "superuser")
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{t("permissionDeniedProblem")}</p>
        <Link href="/probleme" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToProblemsLink")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="mx-auto max-w-4xl px-4 py-6 sm:px-6"
    >
      {contestSlug && (
        <div className="mb-4">
          <Link
            href={`/concursuri/${contestSlug}`}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            {t("backToContestLink")}
          </Link>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          {contestSlug ? t("newProblemForContest") : t("newProblem")}
        </h1>
        <div className="flex items-center gap-2">
          {contestSlug ? (
            <>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("addToContest")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => router.push(`/concursuri/${contestSlug}`)}
                aria-label={t("closeLabel")}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="submit"
                variant="outline"
                size="sm"
                disabled={submitting}
                onClick={() => setPublishMode("draft")}
              >
                {submitting && publishMode === "draft" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("saveDraft")}
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                onClick={() => setPublishMode("public")}
              >
                {submitting && publishMode === "public" ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {t("publish")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => router.push("/probleme")}
                aria-label={t("closeLabel")}
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input
                id="title"
                {...register("title")}
                onChange={handleTitleChange}
                placeholder="Suma elementelor"
                className={cn(errors.title && "border-destructive")}
              />
              {errors.title && (
                <p className="text-xs text-destructive">{errors.title.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">
                {t("slugLabel")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {t("slugAuto")}
                </span>
              </Label>
              <Input
                id="slug"
                {...register("slug")}
                placeholder="suma-elementelor"
                className={cn("font-mono", errors.slug && "border-destructive")}
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
            </div>
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
                    placeholder={t("statementPlaceholderRo")}
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
                    <ProblemStatement
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

          {watchProblemType === "standard" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="input_format">{t("inputFormatLabel")}</Label>
                <textarea
                  id="input_format"
                  {...register("input_format")}
                  rows={4}
                  placeholder={t("inputFormatPlaceholder")}
                  className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="output_format">{t("outputFormatLabel")}</Label>
                <textarea
                  id="output_format"
                  {...register("output_format")}
                  rows={4}
                  placeholder={t("outputFormatPlaceholder")}
                  className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <Separator />

          {watchProblemType === "dataset" ? (
            <DatasetConfigFields
              register={register}
              setValue={setValue}
              watch={watch}
              datasetFiles={datasetFiles}
              setDatasetFiles={setDatasetFiles}
            />
          ) : watchProblemType === "quiz" ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>{t("quizOptionsLabel")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() =>
                    appendQuizOption({ text_md: "", is_correct: false, explanation_md: "" })
                  }
                >
                  <Plus className="h-3 w-3" />
                  {t("addOption")}
                </Button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                {t("quizCorrectHint")}
              </p>

              {quizOptionFields.length === 0 ? (
                <p className="rounded border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  {t("noOptions")}{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      appendQuizOption({ text_md: "", is_correct: false, explanation_md: "" })
                    }
                  >
                    {t("addFirstOption")}
                  </button>
                </p>
              ) : (
                <div className="space-y-3">
                  {quizOptionFields.map((field, index) => (
                    <QuizOptionRow
                      key={field.id}
                      index={index}
                      register={register}
                      errors={errors}
                      onRemove={() => removeQuizOption(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>{t("testCasesLabel")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1"
                  onClick={() =>
                    append({ input_content: "", output_content: "", score: 10, is_sample: false })
                  }
                >
                  <Plus className="h-3 w-3" />
                  {t("addProblem")}
                </Button>
              </div>

              {testCaseFields.length === 0 ? (
                <p className="rounded border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  {t("noTestCases")}{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      append({
                        input_content: "",
                        output_content: "",
                        score: 10,
                        is_sample: false,
                      })
                    }
                  >
                    {t("addFirstTestCase")}
                  </button>
                </p>
              ) : (
                <div className="space-y-4">
                  {testCaseFields.map((field, index) => (
                    <TestCaseRow
                      key={field.id}
                      index={index}
                      register={register}
                      setValue={setValue}
                      errors={errors}
                      onRemove={() => remove(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("typeLabel")}</Label>
            <Select
              defaultValue="standard"
              onValueChange={(v) => setValue("problem_type", v as FormValues["problem_type"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">{t("typeStandardDesc")}</SelectItem>
                <SelectItem value="quiz">{t("typeQuizDesc")}</SelectItem>
                <SelectItem value="dataset">{t("typeDatasetDesc")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("difficulty")}</Label>
            <Select
              defaultValue="3"
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
              <Label htmlFor="time_limit_ms" className="text-xs">
                {t("timeLimitLabel")}
              </Label>
              <Input
                id="time_limit_ms"
                type="number"
                {...register("time_limit_ms")}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="memory_limit_kb" className="text-xs">
                {t("memoryLimitLabel")}
              </Label>
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
              defaultValue="exact"
              onValueChange={(v) =>
                setValue("comparison_mode", v as FormValues["comparison_mode"])
              }
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
              <Label htmlFor="float_epsilon" className="text-xs">
                {t("epsilonLabel")}
              </Label>
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
  );
}

type RegisterFn = ReturnType<typeof useForm<FormValues>>["register"];
type ErrorsType = ReturnType<typeof useForm<FormValues>>["formState"]["errors"];
type WatchFn = ReturnType<typeof useForm<FormValues>>["watch"];

interface DatasetFilesState {
  train_csv: File | null;
  test_csv: File | null;
  sample_submission_csv: File | null;
  answer_csv: File | null;
}

function DatasetConfigFields({
  register,
  setValue,
  watch,
  datasetFiles,
  setDatasetFiles,
}: {
  register: RegisterFn;
  setValue: UseFormSetValue<FormValues>;
  watch: WatchFn;
  datasetFiles: DatasetFilesState;
  setDatasetFiles: (files: DatasetFilesState) => void;
}) {
  const t = useTranslations("problems");
  const metric = watch("dataset_metric");

  const fileFields: { key: keyof DatasetFilesState; label: string }[] = [
    { key: "train_csv", label: t("datasetFileTrain") },
    { key: "test_csv", label: t("datasetFileTest") },
    { key: "sample_submission_csv", label: t("datasetFileSampleSubmission") },
    { key: "answer_csv", label: t("datasetFileAnswer") },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>{t("datasetMetricLabel")}</Label>
          <Select
            defaultValue="accuracy"
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
          defaultChecked
          {...register("require_source_in_contest")}
          className="h-3.5 w-3.5 rounded border-border"
        />
        {t("datasetRequireSourceLabel")}
      </label>

      <Separator />

      <div>
        <Label className="mb-2 block">{t("datasetFilesLabel")}</Label>
        <div className="grid gap-3 sm:grid-cols-2">
          {fileFields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={`dataset-file-${key}`} className="text-xs text-muted-foreground">
                {label}
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

function QuizOptionRow({
  index,
  register,
  errors,
  onRemove,
}: {
  index: number;
  register: RegisterFn;
  errors: ErrorsType;
  onRemove: () => void;
}) {
  return (
    <div className="rounded border border-border p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">Opțiunea {index + 1}</span>
        <div className="flex items-center gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              {...register(`quizOptions.${index}.is_correct`)}
              className="h-3 w-3 rounded border-border"
            />
            Corect
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <textarea
          {...register(`quizOptions.${index}.text_md`)}
          rows={2}
          placeholder="Textul opțiunii (Markdown suportat)"
          className={cn(
            "w-full rounded border border-input bg-muted/30 px-2 py-1.5 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
            errors.quizOptions?.[index]?.text_md && "border-destructive",
          )}
        />
        {errors.quizOptions?.[index]?.text_md && (
          <p className="text-xs text-destructive">{errors.quizOptions[index].text_md?.message}</p>
        )}
        <textarea
          {...register(`quizOptions.${index}.explanation_md`)}
          rows={2}
          placeholder="Explicație (opțional, afișată după răspuns)"
          className="w-full rounded border border-input bg-muted/30 px-2 py-1.5 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
    </div>
  );
}

function TestCaseRow({
  index,
  register,
  setValue,
  errors,
  onRemove,
}: {
  index: number;
  register: RegisterFn;
  setValue: UseFormSetValue<FormValues>;
  errors: ErrorsType;
  onRemove: () => void;
}) {
  const [mode, setMode] = useState<"text" | "file">("text");
  const inFileRef = useRef<HTMLInputElement>(null);
  const outFileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (type: "in" | "out", file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = (e.target?.result as string) ?? "";
        if (type === "in") {
          setValue(`testCases.${index}.input_content`, text, { shouldValidate: true });
        } else {
          setValue(`testCases.${index}.output_content`, text, { shouldValidate: true });
        }
      };
      reader.readAsText(file);
    },
    [index, setValue],
  );

  return (
    <div className="rounded border border-border p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-muted-foreground">#{index + 1}</span>
          <div className="flex rounded border border-border text-xs">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={cn(
                "px-2 py-0.5 transition-colors",
                mode === "text" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cn(
                "px-2 py-0.5 transition-colors",
                mode === "file" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              Fișier
            </button>
          </div>
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              {...register(`testCases.${index}.is_sample`)}
              className="h-3 w-3 rounded border-border"
            />
            Eșantion
          </label>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>Scor:</span>
            <Input
              type="number"
              {...register(`testCases.${index}.score`)}
              className="h-6 w-14 text-xs"
            />
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {mode === "text" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 font-mono text-xs text-muted-foreground">Input</p>
            <textarea
              {...register(`testCases.${index}.input_content`)}
              rows={4}
              placeholder="1 2 3 4 5"
              className={cn(
                "w-full rounded border border-input bg-muted/30 px-2 py-1.5 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                errors.testCases?.[index]?.input_content && "border-destructive",
              )}
            />
          </div>
          <div>
            <p className="mb-1 font-mono text-xs text-muted-foreground">Output</p>
            <textarea
              {...register(`testCases.${index}.output_content`)}
              rows={4}
              placeholder="15"
              className={cn(
                "w-full rounded border border-input bg-muted/30 px-2 py-1.5 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                errors.testCases?.[index]?.output_content && "border-destructive",
              )}
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Fișier .in</p>
            <input
              ref={inFileRef}
              type="file"
              accept=".in,text/*"
              onChange={(e) => handleFileChange("in", e.target.files?.[0])}
              className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground"
            />
            {errors.testCases?.[index]?.input_content && (
              <p className="text-xs text-destructive">Selectează un fișier</p>
            )}
          </div>
          <div className="space-y-1">
            <p className="font-mono text-xs text-muted-foreground">Fișier .out</p>
            <input
              ref={outFileRef}
              type="file"
              accept=".out,text/*"
              onChange={(e) => handleFileChange("out", e.target.files?.[0])}
              className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground"
            />
            {errors.testCases?.[index]?.output_content && (
              <p className="text-xs text-destructive">Selectează un fișier</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
