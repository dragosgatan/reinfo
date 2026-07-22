"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Languages, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link } from "@/i18n/navigation";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { api, ApiError } from "@/lib/api";
import {
  LESSON_CATEGORIES,
  LESSON_LEVELS,
  LessonReadSchema,
  type LessonCategory,
  type LessonLevel,
  type LessonRead,
  type QuizQuestion,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type FormValues = {
  title: string;
  slug: string;
  category: LessonCategory;
  level: LessonLevel;
  ordinal: number;
  content_md: string;
  content_md_en: string;
  content_md_hu: string;
  teacher_notes_md: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 128);
}

type QuizDraft = {
  id: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
};

function emptyQuiz(n: number): QuizDraft {
  return {
    id: `q${n}`,
    question: "",
    options: ["", "", "", ""],
    correct: 0,
    explanation: "",
  };
}

function QuizRow({
  quiz,
  index,
  onChange,
  onRemove,
}: {
  quiz: QuizDraft;
  index: number;
  onChange: (draft: QuizDraft) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("learning");
  const set = (patch: Partial<QuizDraft>) => onChange({ ...quiz, ...patch });

  return (
    <div className="rounded border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Quiz #{index + 1} - {t("quizIdLabel")}: <code>{quiz.id}</code>
          <span className="ml-2 text-muted-foreground/60">
            (embed via{" "}
            <code className="rounded bg-muted px-1">{`<!-- quiz:${quiz.id} -->`}</code>)
          </span>
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div className="space-y-1">
          <Label className="text-xs">{t("quizIdLabel")}</Label>
          <Input
            value={quiz.id}
            onChange={(e) => set({ id: e.target.value })}
            placeholder="q1"
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("quizCorrectAnswer")}</Label>
          <Input
            type="number"
            min={0}
            max={quiz.options.length - 1}
            value={quiz.correct}
            onChange={(e) => set({ correct: Number(e.target.value) })}
            className="h-7 text-xs"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("quizQuestionLabel")}</Label>
        <Input
          value={quiz.question}
          onChange={(e) => set({ question: e.target.value })}
          placeholder="Ce este...?"
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">{t("quizOptionsLabel")}</Label>
          <button
            type="button"
            onClick={() => set({ options: [...quiz.options, ""] })}
            className="text-xs text-primary hover:underline"
          >
            {t("quizAddOption")}
          </button>
        </div>
        <div className="space-y-1.5">
          {quiz.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  i === quiz.correct
                    ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {i}
              </span>
              <Input
                value={opt}
                onChange={(e) => {
                  const opts = [...quiz.options];
                  opts[i] = e.target.value;
                  set({ options: opts });
                }}
                placeholder={`Varianta ${i}`}
                className="h-7 text-sm"
              />
              {quiz.options.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const opts = quiz.options.filter((_, j) => j !== i);
                    set({
                      options: opts,
                      correct: quiz.correct >= opts.length ? 0 : quiz.correct,
                    });
                  }}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">{t("quizExplanationLabel")}</Label>
        <Input
          value={quiz.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          placeholder={t("quizExplanationPlaceholder")}
          className="text-sm"
        />
      </div>
    </div>
  );
}

interface LessonEditorProps {
  initial?: LessonRead;
}

export function LessonEditor({ initial }: LessonEditorProps) {
  const t = useTranslations("learning");
  const router = useRouter();
  const isEdit = !!initial;

  const [submitting, setSubmitting] = useState(false);
  const [contentLang, setContentLang] = useState<"ro" | "en" | "hu">("ro");
  const [translating, setTranslating] = useState(false);
  const publishIntentRef = useRef<boolean>(initial?.published ?? false);
  const [quizzes, setQuizzes] = useState<QuizDraft[]>(
    (initial?.quizzes as QuizQuestion[] | undefined)?.map((q) => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correct: q.correct,
      explanation: q.explanation,
    })) ?? [],
  );
  const [notesTab, setNotesTab] = useState<"edit" | "preview">("edit");

  const schema = z.object({
    title: z.string().min(1, t("titleRequired")).max(256),
    slug: z
      .string()
      .min(1, t("slugRequired"))
      .max(128)
      .regex(/^[a-z0-9-]+$/, t("slugInvalid")),
    category: z.enum(LESSON_CATEGORIES),
    level: z.enum(LESSON_LEVELS),
    ordinal: z.coerce.number().int().min(0).default(0),
    content_md: z.string().default(""),
    content_md_en: z.string().default(""),
    content_md_hu: z.string().default(""),
    teacher_notes_md: z.string().default(""),
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initial?.title ?? "",
      slug: initial?.slug ?? "",
      category: initial?.category ?? "basics",
      level: initial?.level ?? "beginner",
      ordinal: initial?.ordinal ?? 0,
      content_md: initial?.content_md ?? "",
      content_md_en: initial?.content_md_en ?? "",
      content_md_hu: initial?.content_md_hu ?? "",
      teacher_notes_md: initial?.teacher_notes_md ?? "",
    },
  });

  const watchTitle = watch("title");
  const watchSlug = watch("slug");
  const watchContent = watch("content_md");
  const watchContentEn = watch("content_md_en");
  const watchContentHu = watch("content_md_hu");
  const watchNotes = watch("teacher_notes_md");

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const title = e.target.value;
      setValue("title", title);
      if (!isEdit && (!watchSlug || watchSlug === slugify(watchTitle ?? ""))) {
        setValue("slug", slugify(title));
      }
    },
    [setValue, watchSlug, watchTitle, isEdit],
  );

  const addQuiz = useCallback(() => {
    setQuizzes((prev) => [...prev, emptyQuiz(prev.length + 1)]);
  }, []);

  const removeQuiz = useCallback((i: number) => {
    setQuizzes((prev) => prev.filter((_, j) => j !== i));
  }, []);

  const updateQuiz = useCallback((i: number, draft: QuizDraft) => {
    setQuizzes((prev) => prev.map((q, j) => (j === i ? draft : q)));
  }, []);

  const handleTranslate = useCallback(async () => {
    const sourceText =
      contentLang === "ro"
        ? watchContent
        : contentLang === "en"
          ? watchContentEn
          : watchContentHu;

    if (!sourceText?.trim()) {
      toast.error(t("sourceContentEmpty"));
      return;
    }

    const targetLangs = (["ro", "en", "hu"] as const).filter((l) => l !== contentLang);

    setTranslating(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: sourceText, sourceLang: contentLang, targetLangs }),
      });
      const data = await res.json() as { results?: Record<string, string>; error?: string; model?: string };

      if (!res.ok || data.error) {
        toast.error(data.error ?? t("translationFailed"));
        return;
      }

      const results = data.results ?? {};
      if (results.ro !== undefined) setValue("content_md", results.ro);
      if (results.en !== undefined) setValue("content_md_en", results.en);
      if (results.hu !== undefined) setValue("content_md_hu", results.hu);

      const modelShort = (data.model ?? "").split("/").pop()?.replace(":free", "") ?? "";
      const langs = targetLangs.map((l) => l.toUpperCase()).join(", ");
      toast.success(t("translatedTo", { langs }) + (modelShort ? ` · ${modelShort}` : ""));
    } catch {
      toast.error(t("translationError"));
    } finally {
      setTranslating(false);
    }
  }, [contentLang, watchContent, watchContentEn, watchContentHu, setValue, t]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      const publishing = publishIntentRef.current;
      try {
        const payload = {
          slug: values.slug,
          title: values.title,
          category: values.category,
          level: values.level,
          ordinal: values.ordinal,
          content_md: values.content_md,
          content_md_en: values.content_md_en || null,
          content_md_hu: values.content_md_hu || null,
          teacher_notes_md: values.teacher_notes_md || null,
          quizzes: quizzes.filter((q) => q.question.trim()),
          published: publishing,
        };

        if (isEdit) {
          await api.patch(`/api/lessons/${initial!.slug}`, payload, LessonReadSchema);
          toast.success(t("lessonUpdated"));
          router.push(`/invatare/${values.slug}`);
        } else {
          const lesson = await api.post("/api/lessons", payload, LessonReadSchema);
          toast.success(publishing ? t("lessonPublished") : t("draftSavedToast"));
          router.push(`/invatare/${lesson.slug}`);
        }
      } catch (err) {
        console.error("[LessonEditor] submit error:", err);
        const msg =
          err instanceof ApiError && err.status === 409
            ? t("slugConflict")
            : err instanceof ApiError
              ? err.detail
              : err instanceof Error
                ? err.message
                : t("errorGenericToast");
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [quizzes, isEdit, initial, router, t],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={isEdit ? `/invatare/${initial!.slug}` : "/invatare"}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {isEdit ? t("backToLesson") : t("backToLearning")}
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <h1 className="text-lg font-semibold tracking-tight">
            {isEdit ? t("editLesson") : t("newLesson")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isEdit && (
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => { publishIntentRef.current = false; }}
            >
              {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {t("saveDraft")}
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            onClick={() => { publishIntentRef.current = true; }}
          >
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isEdit ? t("saveChanges") : t("publish")}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input
                id="title"
                {...register("title")}
                onChange={handleTitleChange}
                placeholder={t("titlePlaceholder")}
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
                  {isEdit ? t("slugFixed") : t("slugAuto")}
                </span>
              </Label>
              <Input
                id="slug"
                {...register("slug")}
                readOnly={isEdit}
                placeholder="introducere-recursivitate"
                className={cn(
                  "font-mono",
                  isEdit && "cursor-not-allowed opacity-60",
                  errors.slug && "border-destructive",
                )}
              />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="mb-2 flex items-center justify-between">
              <Label>{t("contentLabel")}</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTranslate}
                  disabled={translating}
                  className="flex items-center gap-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground disabled:opacity-50"
                  title={t("translateFrom", { lang: contentLang.toUpperCase() })}
                >
                  {translating ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Languages className="h-3 w-3" />
                  )}
                  {t("translateFrom", { lang: contentLang.toUpperCase() })}
                </button>
                <div className="flex rounded border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setContentLang("ro")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      contentLang === "ro"
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    RO
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentLang("en")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      contentLang === "en"
                        ? "bg-muted font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setContentLang("hu")}
                    className={cn(
                      "px-2.5 py-1 transition-colors",
                      contentLang === "hu"
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
                <div className={cn(contentLang !== "ro" && "hidden")}>
                  <textarea
                    {...register("content_md")}
                    rows={16}
                    placeholder={t("contentPlaceholderRo")}
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className={cn(contentLang !== "en" && "hidden")}>
                  <textarea
                    {...register("content_md_en")}
                    rows={16}
                    placeholder={t("contentPlaceholderEn")}
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className={cn(contentLang !== "hu" && "hidden")}>
                  <textarea
                    {...register("content_md_hu")}
                    rows={16}
                    placeholder={t("contentPlaceholderHu")}
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <ContentPreview
                  markdown={
                    (contentLang === "ro"
                      ? watchContent
                      : contentLang === "en"
                        ? watchContentEn
                        : watchContentHu) ?? ""
                  }
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                {t("notesLabel")}{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  {t("notesHint")}
                </span>
              </Label>
              <div className="flex rounded border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setNotesTab("edit")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 transition-colors",
                    notesTab === "edit"
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <EyeOff className="h-3 w-3" />
                  {t("editTab")}
                </button>
                <button
                  type="button"
                  onClick={() => setNotesTab("preview")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 transition-colors",
                    notesTab === "preview"
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="h-3 w-3" />
                  {t("previewTab")}
                </button>
              </div>
            </div>
            {notesTab === "edit" ? (
              <textarea
                {...register("teacher_notes_md")}
                rows={6}
                placeholder={t("notesPlaceholder")}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <ContentPreview markdown={watchNotes ?? ""} />
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t("quizLabel")}</Label>
              <button
                type="button"
                onClick={addQuiz}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("addQuestion")}
              </button>
            </div>
            {quizzes.length === 0 ? (
              <p className="rounded border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
                {t("noQuestions")}{" "}
                <button type="button" onClick={addQuiz} className="text-primary hover:underline">
                  {t("addFirstQuestion")}
                </button>
                <br />
                <span className="text-xs">
                  {t("quizEmbedHelp")}{" "}
                  <code className="rounded bg-muted px-1">{`<!-- quiz:q1 -->`}</code>
                </span>
              </p>
            ) : (
              <div className="space-y-3">
                {quizzes.map((q, i) => (
                  <QuizRow
                    key={i}
                    quiz={q}
                    index={i}
                    onChange={(d) => updateQuiz(i, d)}
                    onRemove={() => removeQuiz(i)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("categoryLabel")}</Label>
            <Select
              defaultValue={initial?.category ?? "basics"}
              onValueChange={(v) => setValue("category", v as LessonCategory)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`categories.${cat}` as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("levelLabel")}</Label>
            <Select
              defaultValue={initial?.level ?? "beginner"}
              onValueChange={(v) => setValue("level", v as LessonLevel)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LESSON_LEVELS.map((lvl) => (
                  <SelectItem key={lvl} value={lvl}>
                    {t(`levels.${lvl}` as any)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ordinal">
              {t("ordinalLabel")}{" "}
              <span className="text-xs font-normal text-muted-foreground">{t("ordinalHint")}</span>
            </Label>
            <Input
              id="ordinal"
              type="number"
              min={0}
              {...register("ordinal")}
              className="h-8 text-sm"
            />
          </div>

          <Separator />

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">{t("quizSyntaxHeading")}</p>
            <p>
              {t.rich("quizSyntaxHelp1", {
                code: () => <code className="rounded bg-muted px-1">{`<!-- quiz:ID -->`}</code>,
              })}
            </p>
            <p>{t("quizSyntaxHelp2")}</p>
          </div>
        </aside>
      </div>
    </form>
  );
}

function ContentPreview({ markdown }: { markdown: string }) {
  const t = useTranslations("learning");
  if (!markdown) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded border border-border text-sm text-muted-foreground">
        {t("previewPlaceholder")}
      </div>
    );
  }
  return (
    <div className="min-h-[120px] rounded border border-border p-4">
      <MarkdownContent markdown={markdown} />
    </div>
  );
}