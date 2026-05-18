"use client";

import { isValidElement, useCallback, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Pencil,
  Play,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  LESSON_CATEGORY_LABELS,
  LESSON_LEVEL_LABELS,
  type LessonListItem,
  type LessonRead,
  type QuizQuestion,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

declare global {
  interface Window {
    loadPyodide?: (opts: { indexURL: string }) => Promise<PyodideInterface>;
  }
}

interface PyodideInterface {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
}

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.27.6/full/";

const QUIZ_MARKER_RE = /<!--\s*quiz:([\w-]+)\s*-->/g;

function childrenToString(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(childrenToString).join("");
  if (isValidElement(node)) {
    return childrenToString((node.props as { children?: React.ReactNode }).children ?? "");
  }
  return "";
}

function splitContentByQuizzes(
  content: string,
): Array<{ type: "text"; value: string } | { type: "quiz"; id: string }> {
  const parts: Array<{ type: "text"; value: string } | { type: "quiz"; id: string }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  QUIZ_MARKER_RE.lastIndex = 0;

  while ((match = QUIZ_MARKER_RE.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: "quiz", id: match[1] });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", value: content.slice(lastIndex) });
  }
  return parts;
}

function usePyodide() {
  const ref = useRef<PyodideInterface | null>(null);
  const onReadyRef = useRef<(() => void) | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const load = useCallback(async (onReady?: () => void) => {
    if (ref.current) {
      onReady?.();
      return;
    }
    if (onReady) onReadyRef.current = onReady;
    if (status === "loading") return;
    setStatus("loading");
    try {
      if (!document.querySelector(`script[src="${PYODIDE_CDN}pyodide.js"]`)) {
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = `${PYODIDE_CDN}pyodide.js`;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error("failed to load pyodide"));
          document.head.appendChild(s);
        });
      }
      const py = await window.loadPyodide!({ indexURL: PYODIDE_CDN });
      ref.current = py;
      setStatus("ready");
      const cb = onReadyRef.current;
      onReadyRef.current = null;
      cb?.();
    } catch {
      setStatus("error");
    }
  }, [status]);

  return { pyodide: ref, status, load };
}

function RunnablePython({
  code,
  pyodide,
  pyStatus,
  onLoadPyodide,
}: {
  code: string;
  pyodide: React.MutableRefObject<PyodideInterface | null>;
  pyStatus: "idle" | "loading" | "ready" | "error";
  onLoadPyodide: (onReady?: () => void) => void;
}) {
  const t = useTranslations("learning");
  const [output, setOutput] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const execute = useCallback(async () => {
    if (!pyodide.current) return;
    setRunning(true);
    setOutput(null);
    const lines: string[] = [];
    pyodide.current.setStdout({ batched: (s) => lines.push(s) });
    pyodide.current.setStderr({ batched: (s) => lines.push(`[stderr] ${s}`) });
    try {
      await pyodide.current.runPythonAsync(code);
    } catch (err) {
      lines.push(String(err));
    }
    setOutput(lines.join("\n") || "(fără output)");
    setRunning(false);
  }, [code, pyodide]);

  const run = useCallback(() => {
    if (pyStatus !== "ready") {
      onLoadPyodide(execute);
      return;
    }
    void execute();
  }, [pyStatus, onLoadPyodide, execute]);

  return (
    <div className="my-4 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-4 py-2">
        <span className="font-mono text-xs text-muted-foreground">python</span>
        <button
          onClick={run}
          disabled={running || pyStatus === "loading"}
          className={cn(
            "flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors",
            "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50",
          )}
        >
          {running || pyStatus === "loading" ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("running")}
            </>
          ) : (
            <>
              <Play className="h-3 w-3" />
              {t("runCode")}
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto bg-muted px-4 py-3 font-mono text-xs">
        <code>{code}</code>
      </pre>
      {output !== null && (
        <div className="border-t border-border bg-muted/30 px-4 py-3">
          <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("output")}
          </p>
          <pre className="overflow-x-auto font-mono text-xs text-foreground">{output}</pre>
        </div>
      )}
    </div>
  );
}

function QuizBlock({ quiz }: { quiz: QuizQuestion }) {
  const t = useTranslations("learning");
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;

  return (
    <div className="my-6 rounded-lg border border-border bg-card p-5">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t("quizTitle")}
      </p>
      <p className="mb-4 text-sm font-medium">{quiz.question}</p>
      <div className="space-y-2">
        {quiz.options.map((opt, i) => {
          const isCorrect = i === quiz.correct;
          const isSelected = selected === i;
          return (
            <button
              key={i}
              disabled={answered}
              onClick={() => setSelected(i)}
              className={cn(
                "w-full rounded-md border px-4 py-2.5 text-left text-sm transition-colors",
                !answered && "border-border hover:border-foreground/30 hover:bg-muted/40",
                answered &&
                  isCorrect &&
                  "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                answered &&
                  isSelected &&
                  !isCorrect &&
                  "border-rose-500 bg-rose-500/10 text-rose-700 dark:text-rose-400",
                answered && !isSelected && !isCorrect && "border-border opacity-50",
              )}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="mt-4 rounded-md bg-muted/50 px-4 py-3 text-sm">
          <p className="mb-1 font-semibold">
            {selected === quiz.correct ? t("quizCorrect") : t("quizWrong")}
          </p>
          {quiz.explanation && (
            <p className="text-muted-foreground">
              <span className="font-medium">{t("quizExplanation")}: </span>
              {quiz.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const MD_COMPONENTS = {
  p: ({ children }: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p className="mb-4 text-sm leading-7 last:mb-0">{children}</p>
  ),
  h1: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h1 className="mb-3 mt-8 text-xl font-bold first:mt-0">{children}</h1>
  ),
  h2: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2 className="mb-2 mt-6 text-base font-semibold first:mt-0">{children}</h2>
  ),
  h3: ({ children }: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground first:mt-0">
      {children}
    </h3>
  ),
  ul: ({ children }: React.HTMLAttributes<HTMLUListElement>) => (
    <ul className="mb-4 list-disc space-y-1 pl-5 text-sm">{children}</ul>
  ),
  ol: ({ children }: React.HTMLAttributes<HTMLOListElement>) => (
    <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">{children}</ol>
  ),
  li: ({ children }: React.HTMLAttributes<HTMLLIElement>) => (
    <li className="leading-relaxed">{children}</li>
  ),
  strong: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: React.HTMLAttributes<HTMLElement>) => <em className="italic">{children}</em>,
  blockquote: ({ children }: React.HTMLAttributes<HTMLElement>) => (
    <blockquote className="mb-4 border-l-2 border-border pl-4 italic text-muted-foreground text-sm">
      {children}
    </blockquote>
  ),
  pre: ({ children }: React.HTMLAttributes<HTMLPreElement>) => (
    <pre className="mb-4 overflow-x-auto rounded border border-border bg-muted p-4 font-mono text-xs leading-relaxed">
      {children}
    </pre>
  ),
  a: ({ href, children }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      className="text-primary underline underline-offset-2 hover:text-primary/80"
      target="_blank"
      rel="noopener noreferrer"
    >
      {children}
    </a>
  ),
  hr: () => <hr className="my-6 border-border" />,
  table: ({ children }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="mb-4 overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  th: ({ children }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th className="border border-border bg-muted px-3 py-1.5 text-left text-xs font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td className="border border-border px-3 py-1.5 text-sm">{children}</td>
  ),
};

interface LessonViewProps {
  lesson: LessonRead;
  prevLesson: LessonListItem | null;
  nextLesson: LessonListItem | null;
}

export function LessonView({ lesson, prevLesson, nextLesson }: LessonViewProps) {
  const t = useTranslations("learning");
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher" || user?.role === "admin";

  const [isCompleted, setIsCompleted] = useState(lesson.is_completed);
  const [completing, setCompleting] = useState(false);

  const { pyodide, status: pyStatus, load: loadPyodide } = usePyodide();

  const quizMap = new Map<string, QuizQuestion>(
    (lesson.quizzes as QuizQuestion[]).map((q) => [q.id, q]),
  );

  const parts = splitContentByQuizzes(lesson.content_md);

  const toggleComplete = useCallback(async () => {
    if (!user) return;
    setCompleting(true);
    try {
      if (isCompleted) {
        await api.delete(`/api/lessons/${lesson.slug}/complete`);
        setIsCompleted(false);
      } else {
        await api.post(`/api/lessons/${lesson.slug}/complete`, {});
        setIsCompleted(true);
      }
    } finally {
      setCompleting(false);
    }
  }, [isCompleted, lesson.slug, user]);

  const markdownComponents = {
    ...MD_COMPONENTS,
    code({
      className,
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) {
      const language = /language-(\w+)/.exec(className || "")?.[1];
      const codeStr = childrenToString(children).replace(/\n$/, "");

      if (language === "python" && !props.inline) {
        return (
          <RunnablePython
            code={codeStr}
            pyodide={pyodide}
            pyStatus={pyStatus}
            onLoadPyodide={loadPyodide}
          />
        );
      }

      if (language) {
        return (
          <code className={cn("text-xs", className)} {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs" {...props}>
          {children}
        </code>
      );
    },
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/invatare" className="hover:text-foreground">
          {t("backToLearning")}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>{LESSON_CATEGORY_LABELS[lesson.category]}</span>
      </div>

      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {LESSON_LEVEL_LABELS[lesson.level]}
            </span>
            {!lesson.published && (
              <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                {t("draft")}
              </span>
            )}
          </div>
          {isTeacher && (
            <Link
              href={`/invatare/${lesson.slug}/editeaza`}
              className="flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Pencil className="h-3 w-3" />
              Editează
            </Link>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
      </div>

      <div className="space-y-0">
        {parts.map((part, i) => {
          if (part.type === "quiz") {
            const quiz = quizMap.get(part.id);
            return quiz ? <QuizBlock key={i} quiz={quiz} /> : null;
          }
          return (
            <ReactMarkdown
              key={i}
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
              components={markdownComponents as never}
            >
              {part.value}
            </ReactMarkdown>
          );
        })}
      </div>

      {isTeacher && lesson.teacher_notes_md && (
        <div className="mt-10 rounded-lg border border-amber-400/40 bg-amber-50/50 p-5 dark:bg-amber-950/20">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
              {t("teacherNotes")}
            </span>
          </div>
          <div className="text-sm leading-7 text-amber-900 dark:text-amber-200">
            <ReactMarkdown>{lesson.teacher_notes_md}</ReactMarkdown>
          </div>
        </div>
      )}

      <div className="mt-10 flex items-center justify-between border-t border-border pt-8">
        {prevLesson ? (
          <Link
            href={`/invatare/${prevLesson.slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4 shrink-0" />
            <span className="line-clamp-1 max-w-[180px]">{prevLesson.title}</span>
          </Link>
        ) : (
          <div />
        )}

        {user && (
          <button
            onClick={toggleComplete}
            disabled={completing}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              isCompleted
                ? "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            {completing ? "..." : isCompleted ? t("unmarkComplete") : t("markComplete")}
          </button>
        )}

        {nextLesson ? (
          <Link
            href={`/invatare/${nextLesson.slug}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <span className="line-clamp-1 max-w-[180px]">{nextLesson.title}</span>
            <ChevronRight className="h-4 w-4 shrink-0" />
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
