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

export function getDifficultyLabel(difficulty: number): string {
  if (difficulty <= 3) return "Ușor";
  if (difficulty <= 6) return "Mediu";
  if (difficulty <= 8) return "Greu";
  return "Foarte greu";
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
      <div className="flex items-center gap-0.5" title={`Dificultate ${difficulty}/10`}>
        {Array.from({ length: 5 }).map((_, i) => (
          <span
            key={i}
            className={cn("h-1.5 w-1.5 rounded-full", i < filled ? color : "bg-muted")}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-muted-foreground">{getDifficultyLabel(difficulty)}</span>
      )}
    </div>
  );
}
