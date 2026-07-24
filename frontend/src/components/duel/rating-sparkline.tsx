"use client";

import { useTranslations } from "next-intl";

interface RatingSparklineProps {
  history: { rating_after: number }[];
  currentRating: number;
  className?: string;
  /** falls back to the duel-specific "no recent duels" copy for backward compat */
  emptyLabel?: string;
}

export function RatingSparkline({
  history,
  currentRating,
  className,
  emptyLabel,
}: RatingSparklineProps) {
  const t = useTranslations("duel");

  const points =
    history.length === 0
      ? [{ rating: currentRating }]
      : history.map((h) => ({ rating: h.rating_after }));

  if (points.length < 2) {
    return (
      <div className={className}>
        <span className="text-xs text-muted-foreground font-mono">
          {emptyLabel ?? t("noRecentDuels")}
        </span>
      </div>
    );
  }

  const ratings = points.map((p) => p.rating);
  const minR = Math.min(...ratings);
  const maxR = Math.max(...ratings);
  const range = maxR - minR || 1;

  const W = 120;
  const H = 32;
  const pad = 2;

  const toX = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const toY = (r: number) => pad + ((maxR - r) / range) * (H - 2 * pad);

  const pathData = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(p.rating).toFixed(1)}`)
    .join(" ");

  const lastRating = points[points.length - 1].rating;
  const prevRating = points[points.length - 2].rating;
  const trending = lastRating >= prevRating;

  return (
    <div className={className}>
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        className={trending ? "text-success" : "text-destructive"}
        aria-hidden
      >
        <path
          d={pathData}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={toX(points.length - 1).toFixed(1)}
          cy={toY(lastRating).toFixed(1)}
          r="2"
          fill="currentColor"
        />
      </svg>
    </div>
  );
}