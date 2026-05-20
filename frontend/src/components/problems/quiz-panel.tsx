"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, XCircle, Circle, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProblemStatement } from "./problem-statement";
import { api } from "@/lib/api";
import { QuizAttemptResultSchema } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { QuizOptionRead, QuizOptionWithAnswer } from "@/lib/types";

interface QuizPanelProps {
  slug: string;
  options: QuizOptionRead[];
  lang?: "ro" | "en";
}

export function QuizPanel({ slug, options, lang = "ro" }: QuizPanelProps) {
  const t = useTranslations("problems");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{
    correct: boolean;
    options: QuizOptionWithAnswer[];
  } | null>(null);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      api.post(
        `/api/problems/${slug}/quiz-attempt`,
        { selected_option_ids: Array.from(selected) },
        QuizAttemptResultSchema,
      ),
    onSuccess: (data) => setResult(data),
  });

  const toggle = (id: string) => {
    if (result) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const reset = () => {
    setSelected(new Set());
    setResult(null);
  };

  const displayOptions = result
    ? result.options
    : options.map((o) => ({ ...o, is_correct: false, explanation_md: null, explanation_md_en: null }));

  return (
    <div className="space-y-3">
      {result && (
        <div
          className={cn(
            "flex items-center gap-2 rounded border px-3 py-2 text-sm font-medium",
            result.correct
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/30 dark:bg-red-950/20 dark:text-red-300",
          )}
        >
          {result.correct ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {result.correct ? t("quizCorrect") : t("quizWrong")}
        </div>
      )}

      <div className="space-y-2">
        {displayOptions.map((opt) => {
          const isSelected = selected.has(opt.id);
          const showAnswer = result !== null;
          const optResult = result?.options.find((o) => o.id === opt.id);

          let borderClass = "border-border hover:border-foreground/30";
          if (showAnswer) {
            if (optResult?.is_correct) {
              borderClass = "border-green-400 bg-green-50/50 dark:border-green-600 dark:bg-green-950/20";
            } else if (isSelected && !optResult?.is_correct) {
              borderClass = "border-red-400 bg-red-50/50 dark:border-red-600 dark:bg-red-950/20";
            }
          } else if (isSelected) {
            borderClass = "border-primary bg-primary/5";
          }

          const optText = lang === "en" && opt.text_md_en ? opt.text_md_en : opt.text_md;
          const expMd = optResult
            ? lang === "en" && optResult.explanation_md_en
              ? optResult.explanation_md_en
              : optResult.explanation_md
            : null;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              disabled={!!result}
              className={cn(
                "w-full rounded border px-3 py-2.5 text-left transition-colors",
                borderClass,
                result ? "cursor-default" : "cursor-pointer",
              )}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0">
                  {showAnswer ? (
                    optResult?.is_correct ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : isSelected ? (
                      <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground/40" />
                    )
                  ) : isSelected ? (
                    <CheckSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-snug">
                    <ProblemStatement markdown={optText} />
                  </div>
                  {expMd && (
                    <div className="mt-1.5 border-t border-border/50 pt-1.5">
                      <p className="mb-0.5 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {t("quizExplanation")}
                      </p>
                      <div className="prose prose-sm dark:prose-invert max-w-none text-xs text-muted-foreground">
                        <ProblemStatement markdown={expMd} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {!result ? (
        <Button
          size="sm"
          className="w-full"
          disabled={selected.size === 0 || isPending}
          onClick={() => mutate()}
        >
          {isPending ? t("quizVerifying") : t("quizVerify")}
        </Button>
      ) : (
        <Button size="sm" variant="outline" className="w-full" onClick={reset}>
          {t("quizRetry")}
        </Button>
      )}
    </div>
  );
}
