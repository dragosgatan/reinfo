"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, ChevronRight, Map, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  LESSON_CATEGORIES,
  LESSON_LEVELS,
  LessonListResponseSchema,
  type LessonCategory,
  type LessonLevel,
  type LessonListItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const LEVEL_COLORS: Record<LessonLevel, string> = {
  beginner: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  intermediate: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  advanced: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
};

export default function InvatareClient() {
  const t = useTranslations("learning");
  const { user } = useAuth();
  const isTeacher =
    user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";

  const [levelFilter, setLevelFilter] = useState<LessonLevel | "all">("all");
  const [showTeacherView, setShowTeacherView] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["lessons"],
    queryFn: () => api.get("/api/lessons", LessonListResponseSchema),
  });

  const filtered = (data?.items ?? []).filter((lesson) => {
    if (levelFilter !== "all" && lesson.level !== levelFilter) return false;
    return true;
  });

  const byCategory = LESSON_CATEGORIES.reduce<Record<LessonCategory, LessonListItem[]>>(
    (acc, cat) => {
      acc[cat] = filtered.filter((l) => l.category === cat);
      return acc;
    },
    {} as Record<LessonCategory, LessonListItem[]>,
  );

  const activeCats = LESSON_CATEGORIES.filter((c) => byCategory[c].length > 0);

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">
        {t("noLessons")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <Link
        href="/invatare/harti"
        className="mb-8 flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-all hover:border-foreground/20 hover:shadow-sm"
        aria-label="Hărți de parcurs"
      >
        <div className="flex items-center gap-3">
          <Map className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium">Hărți de parcurs</p>
            <p className="text-xs text-muted-foreground">
              Trasee de învățare structurate pentru programare competitivă
            </p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <div className="mb-8 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-border p-1">
          <button
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              levelFilter === "all"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setLevelFilter("all")}
          >
            {t("allLevels")}
          </button>
          {LESSON_LEVELS.map((lvl) => (
            <button
              key={lvl}
              className={cn(
                "rounded px-3 py-1 text-xs font-medium transition-colors",
                levelFilter === lvl
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setLevelFilter(lvl)}
            >
              {t(`levels.${lvl}` as any)}
            </button>
          ))}
        </div>

        {isTeacher && (
          <div className="ml-auto flex items-center gap-2">
            <button
              className={cn(
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                showTeacherView
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
              onClick={() => setShowTeacherView((v) => !v)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              {t("audienceTeacher")}
            </button>
            <Link
              href="/invatare/nou"
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("newLesson")}
            </Link>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : activeCats.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t("noLessons")}</p>
      ) : (
        <div className="space-y-10">
          {activeCats.map((cat) => (
            <section key={cat}>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-muted-foreground">
                {t(`categories.${cat}` as any)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {byCategory[cat].map((lesson) => (
                  <LessonCard
                    key={lesson.id}
                    lesson={lesson}
                    showTeacherHint={showTeacherView}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LessonCard({
  lesson,
  showTeacherHint: _showTeacherHint,
}: {
  lesson: LessonListItem;
  showTeacherHint: boolean;
}) {
  const t = useTranslations("learning");

  return (
    <Link
      href={`/invatare/${lesson.slug}`}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-all",
        "hover:border-foreground/20 hover:shadow-sm",
        !lesson.published && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{lesson.title}</span>
        <div className="flex shrink-0 items-center gap-1.5">
          {!lesson.published && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("draft")}
            </span>
          )}
          {lesson.is_completed ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-[11px] font-medium",
            LEVEL_COLORS[lesson.level],
          )}
        >
          {t(`levels.${lesson.level}` as any)}
        </span>
      </div>
    </Link>
  );
}
