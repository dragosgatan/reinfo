import { cn } from "@/lib/utils";
import type { VerdictType } from "@/lib/types";

const VERDICT_CONFIG: Record<
  VerdictType,
  { label: string; className: string }
> = {
  pending: { label: "În așteptare", className: "bg-muted text-muted-foreground" },
  AC: { label: "Acceptat", className: "bg-success/10 text-success border-success/20" },
  WA: {
    label: "Răspuns greșit",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  CE: {
    label: "Eroare compilare",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  RE: {
    label: "Eroare execuție",
    className: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400",
  },
  TLE: {
    label: "Timp depășit",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  MLE: {
    label: "Memorie depășită",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  PARTIAL: {
    label: "Parțial corect",
    className: "bg-primary/10 text-primary border-primary/20",
  },
};

interface VerdictBadgeProps {
  verdict: VerdictType;
  className?: string;
}

export function VerdictBadge({ verdict, className }: VerdictBadgeProps) {
  const config = VERDICT_CONFIG[verdict] ?? VERDICT_CONFIG.pending;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 font-mono text-xs font-medium",
        config.className,
        className,
      )}
    >
      {verdict === "AC" || verdict === "WA" || verdict === "CE" || verdict === "RE" || verdict === "TLE" || verdict === "MLE" || verdict === "PARTIAL"
        ? verdict
        : config.label}
    </span>
  );
}

export function VerdictLabel({ verdict }: { verdict: VerdictType }) {
  return <span>{VERDICT_CONFIG[verdict]?.label ?? "Necunoscut"}</span>;
}
