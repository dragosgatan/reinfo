"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
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
import { ProblemStatement } from "@/components/problems/problem-statement";
import { api, ApiError } from "@/lib/api";
import {
  LESSON_CATEGORIES,
  LESSON_CATEGORY_LABELS,
  LESSON_LEVEL_LABELS,
  LESSON_LEVELS,
  LessonReadSchema,
  type LessonCategory,
  type LessonLevel,
  type LessonRead,
  type QuizQuestion,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const schema = z.object({
  title: z.string().min(1, "Titlul este obligatoriu").max(256),
  slug: z
    .string()
    .min(1, "Slug-ul este obligatoriu")
    .max(128)
    .regex(/^[a-z0-9-]+$/, "Doar litere mici, cifre și cratimă"),
  category: z.enum(LESSON_CATEGORIES),
  level: z.enum(LESSON_LEVELS),
  ordinal: z.coerce.number().int().min(0).default(0),
  content_md: z.string().default(""),
  teacher_notes_md: z.string().default(""),
});

type FormValues = z.infer<typeof schema>;

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
  const set = (patch: Partial<QuizDraft>) => onChange({ ...quiz, ...patch });

  return (
    <div className="rounded border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">
          Quiz #{index + 1} — id: <code>{quiz.id}</code>
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
          <Label className="text-xs">ID</Label>
          <Input
            value={quiz.id}
            onChange={(e) => set({ id: e.target.value })}
            placeholder="q1"
            className="h-7 font-mono text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Răspuns corect (0-indexed)</Label>
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
        <Label className="text-xs">Întrebare</Label>
        <Input
          value={quiz.question}
          onChange={(e) => set({ question: e.target.value })}
          placeholder="Ce este...?"
          className="text-sm"
        />
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Variante de răspuns</Label>
          <button
            type="button"
            onClick={() => set({ options: [...quiz.options, ""] })}
            className="text-xs text-primary hover:underline"
          >
            + Adaugă variantă
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
        <Label className="text-xs">Explicație (după răspuns)</Label>
        <Input
          value={quiz.explanation}
          onChange={(e) => set({ explanation: e.target.value })}
          placeholder="Explicația răspunsului corect..."
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
  const router = useRouter();
  const isEdit = !!initial;

  const [submitting, setSubmitting] = useState(false);
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
  const [contentTab, setContentTab] = useState<"edit" | "preview">("edit");
  const [notesTab, setNotesTab] = useState<"edit" | "preview">("edit");

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
      teacher_notes_md: initial?.teacher_notes_md ?? "",
    },
  });

  const watchTitle = watch("title");
  const watchSlug = watch("slug");
  const watchContent = watch("content_md");
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
          teacher_notes_md: values.teacher_notes_md || null,
          quizzes: quizzes.filter((q) => q.question.trim()),
          published: publishing,
        };

        if (isEdit) {
          await api.patch(`/api/lessons/${initial!.slug}`, payload, LessonReadSchema);
          toast.success("Lecția a fost actualizată.");
          router.push(`/invatare/${values.slug}`);
        } else {
          const lesson = await api.post("/api/lessons", payload, LessonReadSchema);
          toast.success(publishing ? "Lecția a fost publicată." : "Ciornă salvată.");
          router.push(`/invatare/${lesson.slug}`);
        }
      } catch (err) {
        console.error("[LessonEditor] submit error:", err);
        const msg =
          err instanceof ApiError && err.status === 409
            ? "Există deja o lecție cu acest slug."
            : err instanceof ApiError
              ? err.detail
              : err instanceof Error
                ? err.message
                : "A apărut o eroare.";
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [quizzes, isEdit, initial, router],
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={isEdit ? `/invatare/${initial!.slug}` : "/invatare"}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {isEdit ? "Înapoi la lecție" : "Înapoi la lecții"}
          </Link>
          <span className="text-muted-foreground/40">·</span>
          <h1 className="text-lg font-semibold tracking-tight">
            {isEdit ? "Editare lecție" : "Lecție nouă"}
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
              Salvează ciornă
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            onClick={() => { publishIntentRef.current = true; }}
          >
            {submitting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
            {isEdit ? "Salvează" : "Publică"}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">Titlu</Label>
              <Input
                id="title"
                {...register("title")}
                onChange={handleTitleChange}
                placeholder="Introducere în recursivitate"
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
                  {isEdit ? "(fix)" : "(auto-generat)"}
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
            <div className="flex items-center justify-between">
              <Label>Conținut (Markdown + LaTeX)</Label>
              <div className="flex rounded border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setContentTab("edit")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 transition-colors",
                    contentTab === "edit"
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <EyeOff className="h-3 w-3" />
                  Editare
                </button>
                <button
                  type="button"
                  onClick={() => setContentTab("preview")}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 transition-colors",
                    contentTab === "preview"
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Eye className="h-3 w-3" />
                  Preview
                </button>
              </div>
            </div>
            {contentTab === "edit" ? (
              <textarea
                {...register("content_md")}
                rows={16}
                placeholder={`# Titlul secțiunii\n\nConținut markdown.\n\n\`\`\`python\nprint("Hello")\n\`\`\`\n\n<!-- quiz:q1 -->`}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <ContentPreview markdown={watchContent ?? ""} />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>
                Note profesor{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (vizibil doar pentru profesori/admini)
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
                  Editare
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
                  Preview
                </button>
              </div>
            </div>
            {notesTab === "edit" ? (
              <textarea
                {...register("teacher_notes_md")}
                rows={6}
                placeholder="Note didactice, obiective de învățare, sfaturi pentru predare..."
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            ) : (
              <ContentPreview markdown={watchNotes ?? ""} />
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Întrebări quiz</Label>
              <button
                type="button"
                onClick={addQuiz}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Adaugă întrebare
              </button>
            </div>
            {quizzes.length === 0 ? (
              <p className="rounded border border-dashed border-border py-5 text-center text-sm text-muted-foreground">
                Nicio întrebare.{" "}
                <button type="button" onClick={addQuiz} className="text-primary hover:underline">
                  Adaugă prima
                </button>
                <br />
                <span className="text-xs">
                  Embed în conținut cu{" "}
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
            <Label>Categorie</Label>
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
                    {LESSON_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nivel</Label>
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
                    {LESSON_LEVEL_LABELS[lvl]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ordinal">
              Ordine{" "}
              <span className="text-xs font-normal text-muted-foreground">(în categorie)</span>
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
            <p className="font-medium text-foreground">Sintaxă quiz</p>
            <p>
              Plasează{" "}
              <code className="rounded bg-muted px-1">{`<!-- quiz:ID -->`}</code>{" "}
              în conținut unde vrei să apară o întrebare.
            </p>
            <p>{'ID-ul trebuie să corespundă câmpului „id" din editorul de mai jos.'}</p>
          </div>
        </aside>
      </div>
    </form>
  );
}

function ContentPreview({ markdown }: { markdown: string }) {
  if (!markdown) {
    return (
      <div className="flex min-h-[120px] items-center justify-center rounded border border-border text-sm text-muted-foreground">
        Scrie conținut pentru a vedea previzualizarea
      </div>
    );
  }
  return (
    <div className="min-h-[120px] rounded border border-border p-4">
      <ProblemStatement markdown={markdown} />
    </div>
  );
}
