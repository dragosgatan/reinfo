"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { VerdictType } from "@/lib/types";

const VERDICT_CLASS: Record<VerdictType, string> = {
  pending: "bg-muted text-muted-foreground",
  AC: "bg-success/10 text-success border-success/20",
  WA: "bg-destructive/10 text-destructive border-destructive/20",
  CE: "bg-destructive/10 text-destructive border-destructive/20",
  RE: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  TLE: "bg-warning/10 text-warning border-warning/20",
  MLE: "bg-warning/10 text-warning border-warning/20",
  PARTIAL: "bg-primary/10 text-primary border-primary/20",
  INVALID_FORMAT: "bg-destructive/10 text-destructive border-destructive/20",
};

interface VerdictBadgeProps {
  verdict: VerdictType;
  className?: string;
}

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  const t = useTranslations("problems");
  const cls = VERDICT_CLASS[verdict] ?? VERDICT_CLASS.pending;
  const isCode = verdict !== "pending";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-medium",
        cls,
        className,
      )}
    >
      {isCode ? verdict : t("verdicts.pending")}
    </span>
  );
}

export function VerdictLabel({ verdict }: { verdict: VerdictType }) {
  const t = useTranslations("problems");
  const key = `verdicts.${verdict}` as Parameters<typeof t>[0];
  return <span>{t(key)}</span>;
}
