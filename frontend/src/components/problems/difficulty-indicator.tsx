import { cn } from "@/lib/utils";

interface DifficultyIndicatorProps {
  difficulty: number;
  showLabel?: boolean;
  className?: string;
}

function getDotColor(difficulty: number): string {
  if (difficulty <= 3) return "bg-success";
  if (difficulty <= 6) return "bg-warning";
  if (difficulty <= 8) return "bg-orange-500";
  return "bg-destructive";
}

export function getDifficultyLabel(
  difficulty: number,
  t: (key: string) => string,
): string {
  if (difficulty <= 3) return t("difficultyLevels.easy");
  if (difficulty <= 6) return t("difficultyLevels.medium");
  if (difficulty <= 8) return t("difficultyLevels.hard");
  return t("difficultyLevels.veryHard");
}

export function DifficultyIndicator({
  difficulty,
  showLabel = false,
  className,
}: DifficultyIndicatorProps) {
  const filled = Math.ceil(difficulty / 2);
  const color = getDotColor(difficulty);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div
        className="flex items-center gap-0.5"
        aria-label={`${difficulty}/10`}
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-1.5 rounded-full", i < filled ? color : "bg-muted")}
            aria-hidden="true"
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{difficulty}/10</span>
      )}
    </div>
  );
}
