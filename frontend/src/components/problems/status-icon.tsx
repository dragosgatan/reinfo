import { CheckCircle2, Circle, MinusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type UserStatus = "solved" | "attempted" | "unsolved" | null | undefined;

interface StatusIconProps {
  status: UserStatus;
  className?: string;
}

export function StatusIcon({ status, className }: StatusIconProps) {
  if (status === "solved") {
    return (
      <CheckCircle2
        className={cn("h-3.5 w-3.5 text-success", className)}
        aria-label="Rezolvat"
      />
    );
  }
  if (status === "attempted") {
    return (
      <MinusCircle
        className={cn("h-3.5 w-3.5 text-warning", className)}
        aria-label="Încercat"
      />
    );
  }
  return (
    <Circle
      className={cn("h-3.5 w-3.5 text-muted-foreground/25", className)}
      aria-label="Nerezolvat"
    />
  );
}
