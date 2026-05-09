import { Skeleton } from "@/components/ui/skeleton";

export function ProblemListSkeleton() {
  return (
    <div className="space-y-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 rounded-md border border-border px-4 py-3">
          <Skeleton className="h-4 w-8 shrink-0" />
          <Skeleton className="h-4 w-48" />
          <div className="ml-auto flex items-center gap-3">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-4 w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}
