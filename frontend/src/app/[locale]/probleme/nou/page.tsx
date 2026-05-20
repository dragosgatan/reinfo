"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import type { UseFormSetValue } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2, Eye, EyeOff, Loader2, X } from "lucide-react";
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
import { ProblemReadSchema, ALL_TAGS, TAG_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Titlul este obligatoriu").max(256),
  slug: z
    .string()
    .min(1, "Slug-ul este obligatoriu")
    .max(128)
    .regex(/^[a-z0-9-]+$/, "Doar litere mici, cifre și cratimă"),
  difficulty: z.coerce.number().int().min(1).max(10),
  problem_type: z.enum(["standard", "quiz"]).default("standard"),
  statement_md: z.string().min(1, "Enunțul în română este obligatoriu"),
  statement_md_en: z.string().default(""),
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
        input_content: z.string().min(1, "Input obligatoriu"),
        output_content: z.string().min(1, "Output obligatoriu"),
        score: z.coerce.number().int().min(0).default(10),
        is_sample: z.boolean().default(false),
      }),
    )
    .default([]),
  quizOptions: z
    .array(
      z.object({
        text_md: z.string().min(1, "Textul opțiunii este obligatoriu"),
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const contestSlug = searchParams.get("contest_slug");
  const { user, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [publishMode, setPublishMode] = useState<"draft" | "public">("draft");
  const [statementLang, setStatementLang] = useState<"ro" | "en">("ro");

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
    },
  });

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

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        const visibility = contestSlug ? "contest" : publishMode === "public" ? "public" : "draft";

        const isQuiz = values.problem_type === "quiz";

        const problem = await api.post(
          "/api/problems/",
          {
            slug: values.slug,
            title: values.title,
            statement_md: values.statement_md,
            statement_md_en: values.statement_md_en || null,
            input_format: isQuiz ? "" : (values.input_format ?? ""),
            output_format: isQuiz ? "" : (values.output_format ?? ""),
            difficulty: values.difficulty,
            tags: values.tags,
            visibility,
            problem_type: values.problem_type,
            time_limit_ms: values.time_limit_ms,
            memory_limit_kb: values.memory_limit_kb,
            score_total: isQuiz
              ? 100
              : values.testCases.reduce((sum, tc) => sum + (tc.score ?? 0), 0) || 100,
            comparison_mode: values.comparison_mode,
            float_epsilon:
              values.comparison_mode === "float_epsilon" ? values.float_epsilon : null,
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

        if (!isQuiz) {
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
          toast.success("Problema a fost adăugată la concurs.");
          router.push(`/concursuri/${contestSlug}`);
        } else {
          toast.success(
            publishMode === "public" ? "Problema a fost publicată." : "Ciornă salvată.",
          );
          router.push(`/probleme/${problem.slug}`);
        }
      } catch (err) {
        const msg =
          err instanceof ApiError && err.status === 409
            ? "Există deja o problemă cu acest slug."
            : err instanceof Error
              ? err.message
              : "A apărut o eroare.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [publishMode, contestSlug, router],
  );

  if (isLoading) return null;

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">
          Trebuie să fii profesor sau administrator pentru a adăuga probleme.
        </p>
        <Link href="/probleme" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Înapoi la probleme
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
            ← Înapoi la concurs
          </Link>
        </div>
      )}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">
          {contestSlug ? "Problemă nouă pentru concurs" : "Problemă nouă"}
        </h1>
        <div className="flex items-center gap-2">
          {contestSlug ? (
            <>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Adaugă la concurs
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => router.push(`/concursuri/${contestSlug}`)}
                aria-label="Închide"
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
                Salvează ciornă
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
                Publică
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                onClick={() => router.push("/probleme")}
                aria-label="Închide"
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
              <Label htmlFor="title">Titlu</Label>
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
                Slug{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (auto-generat)
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
              <Label>Enunț</Label>
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
              </div>
            </div>
            <Tabs defaultValue="edit">
              <TabsList className="mb-2">
                <TabsTrigger value="edit">
                  <EyeOff className="mr-1.5 h-3 w-3" />
                  Editare
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="mr-1.5 h-3 w-3" />
                  Previzualizare
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                {statementLang === "ro" ? (
                  <>
                    <textarea
                      {...register("statement_md")}
                      rows={10}
                      placeholder="Enunțul problemei în română (Markdown + LaTeX)."
                      className={cn(
                        "w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                        errors.statement_md && "border-destructive",
                      )}
                    />
                    {errors.statement_md && (
                      <p className="mt-1 text-xs text-destructive">{errors.statement_md.message}</p>
                    )}
                  </>
                ) : (
                  <textarea
                    {...register("statement_md_en")}
                    rows={10}
                    placeholder="Problem statement in English (Markdown + LaTeX). Optional."
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </TabsContent>
              <TabsContent value="preview">
                {(statementLang === "ro" ? watchStatement : watchStatementEn) ? (
                  <div className="min-h-[200px] rounded border border-border p-4">
                    <ProblemStatement
                      markdown={(statementLang === "ro" ? watchStatement : watchStatementEn) ?? ""}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center rounded border border-border text-sm text-muted-foreground">
                    Scrie enunțul pentru a vedea previzualizarea
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          {watchProblemType !== "quiz" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="input_format">Format date de intrare</Label>
                <textarea
                  id="input_format"
                  {...register("input_format")}
                  rows={4}
                  placeholder="Descrierea datelor de intrare (Markdown)"
                  className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="output_format">Format date de ieșire</Label>
                <textarea
                  id="output_format"
                  {...register("output_format")}
                  rows={4}
                  placeholder="Descrierea datelor de ieșire (Markdown)"
                  className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          )}

          <Separator />

          {watchProblemType === "quiz" ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <Label>Opțiuni quiz</Label>
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
                  Adaugă opțiune
                </Button>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Bifează &quot;Corect&quot; pentru una sau mai multe răspunsuri corecte.
              </p>

              {quizOptionFields.length === 0 ? (
                <p className="rounded border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  Nu ai adăugat opțiuni.{" "}
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() =>
                      appendQuizOption({ text_md: "", is_correct: false, explanation_md: "" })
                    }
                  >
                    Adaugă prima
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
                <Label>Cazuri de test</Label>
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
                  Adaugă
                </Button>
              </div>

              {testCaseFields.length === 0 ? (
                <p className="rounded border border-dashed border-border py-6 text-center text-sm text-muted-foreground">
                  Nu ai adăugat cazuri de test.{" "}
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
                    Adaugă primul
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
            <Label>Tip problemă</Label>
            <Select
              defaultValue="standard"
              onValueChange={(v) => setValue("problem_type", v as "standard" | "quiz")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (cod)</SelectItem>
                <SelectItem value="quiz">Quiz (alegere multiplă)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Dificultate</Label>
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
                    {i + 1} —{" "}
                    {i < 3
                      ? "Ușor"
                      : i < 6
                        ? "Mediu"
                        : i < 8
                          ? "Greu"
                          : "Foarte greu"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="time_limit_ms" className="text-xs">
                Timp (ms)
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
                Memorie (KB)
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
            <Label>Mod comparare</Label>
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
                <SelectItem value="exact">Exact</SelectItem>
                <SelectItem value="whitespace_insensitive">Ignoră spații</SelectItem>
                <SelectItem value="float_epsilon">Float epsilon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watchComparisonMode === "float_epsilon" && (
            <div className="space-y-1.5">
              <Label htmlFor="float_epsilon" className="text-xs">
                Epsilon
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
            <Label className="mb-2 block">Etichete</Label>
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
                  {TAG_LABELS[tag] ?? tag}
                </button>
              ))}
            </div>
            {(watchTags ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {watchTags!.map((tag) => (
                  <Badge key={tag} variant="default" className="text-xs">
                    {TAG_LABELS[tag] ?? tag}
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
