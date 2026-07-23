"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
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
  Send,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { MarkdownContent, type CodeBlockRenderer } from "@/components/shared/markdown-content";
import {
  type LessonListItem,
  type LessonRead,
  type QuizQuestion,
} from "@/lib/types";
import { cn } from "@/lib/utils";

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

interface PyodideCtxValue {
  pyodide: React.MutableRefObject<PyodideInterface | null>;
  pyStatus: "idle" | "loading" | "ready" | "error";
  loadPyodide: (onReady?: () => void) => void;
}

const PyodideCtx = createContext<PyodideCtxValue | null>(null);

const QUIZ_MARKER_RE = /<!--\s*quiz:([\w-]+)\s*-->/g;

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

  const load = useCallback(
    async (onReady?: () => void) => {
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
    },
    [status],
  );

  return { pyodide: ref, status, load };
}

function RunnablePython({ code }: { code: string }) {
  const { pyodide, pyStatus, loadPyodide: onLoadPyodide } = useContext(PyodideCtx)!;
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
    setOutput(lines.join("\n") || t("noOutput"));
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

type ChatMessage = { role: "user" | "assistant"; content: string };

function LessonChat({ lesson }: { lesson: LessonRead }) {
  const t = useTranslations("learning");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = messagesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/ai/lesson-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          lesson_slug: lesson.slug,
          lesson_title: lesson.title,
          lesson_content: lesson.content_md,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}) as { detail?: string });
        throw new Error(payload.detail ?? t("aiChatError"));
      }
      if (!res.body) throw new Error(t("aiChatError"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: { delta?: { content?: string } }[];
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = { role: "assistant", content: accumulated };
                return updated;
              });
            }
          } catch {
            // ignore malformed SSE lines
          }
        }
      }
    } catch (err) {
      const content = err instanceof Error && err.message ? err.message : t("aiChatError");
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content };
        return updated;
      });
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }, [input, loading, messages, lesson.slug, lesson.title, lesson.content_md, t]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
    },
    [send],
  );

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{t("aiChat")}</p>
        <p className="text-sm text-muted-foreground">{t("aiChatSubtitle")}</p>
      </div>

      <div ref={messagesRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted-foreground">{t("aiChatEmpty")}</p>
        ) : (
          <div className="space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground",
                  )}
                >
                  {loading && i === messages.length - 1 && msg.role === "assistant" && !msg.content ? (
                    <span className="text-muted-foreground">{t("aiChatThinking")}</span>
                  ) : msg.role === "assistant" ? (
                    <MarkdownContent markdown={msg.content} variant="compact" />
                  ) : (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("aiChatPlaceholder")}
            rows={2}
            className="flex-1 resize-none rounded-md border border-border bg-muted/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            aria-label={t("aiChatSend")}
            className="rounded-md bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

interface LessonViewProps {
  lesson: LessonRead;
  prevLesson: LessonListItem | null;
  nextLesson: LessonListItem | null;
}

export function LessonView({ lesson, prevLesson, nextLesson }: LessonViewProps) {
  const t = useTranslations("learning");
  const { user } = useAuth();
  const isTeacher =
    user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";

  const [isCompleted, setIsCompleted] = useState(lesson.is_completed);
  const [completing, setCompleting] = useState(false);

  const { pyodide, status: pyStatus, load: loadPyodide } = usePyodide();

  const quizMap = new Map<string, QuizQuestion>(
    (lesson.quizzes as QuizQuestion[]).map((q) => [q.id, q]),
  );

  const parts = splitContentByQuizzes(lesson.content_md);

  const renderLessonCodeBlock: CodeBlockRenderer = ({ language, code }) =>
    language === "python" ? <RunnablePython code={code} /> : undefined;

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

  return (
    <div className="flex">
      <div className="min-w-0 flex-1 px-4 py-10 sm:px-6 lg:pr-10">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/invatare" className="hover:text-foreground">
              {t("backToLearning")}
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>{t(`categories.${lesson.category}` as any)}</span>
          </div>

          <div className="mb-8">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {t(`levels.${lesson.level}` as any)}
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
                  {t("editBtn")}
                </Link>
              )}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{lesson.title}</h1>
          </div>

          <PyodideCtx.Provider value={{ pyodide, pyStatus, loadPyodide }}>
            <div className="space-y-0">
              {parts.map((part, i) => {
                if (part.type === "quiz") {
                  const quiz = quizMap.get(part.id);
                  return quiz ? <QuizBlock key={i} quiz={quiz} /> : null;
                }
                return (
                  <MarkdownContent key={i} markdown={part.value} renderCodeBlock={renderLessonCodeBlock} />
                );
              })}
            </div>
          </PyodideCtx.Provider>

          {isTeacher && lesson.teacher_notes_md && (
            <div className="mt-10 rounded-lg border border-amber-400/40 bg-amber-50/50 p-5 dark:bg-amber-950/20">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {t("teacherNotes")}
                </span>
              </div>
              <div className="text-amber-900 dark:text-amber-200">
                <MarkdownContent markdown={lesson.teacher_notes_md} />
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
      </div>

      <aside className="hidden lg:flex w-[420px] shrink-0 flex-col sticky top-12 h-[calc(100vh-3rem)] border-l border-border">
        <LessonChat lesson={lesson} />
      </aside>
    </div>
  );
}
