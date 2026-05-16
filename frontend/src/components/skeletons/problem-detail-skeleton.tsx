import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ProblemDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-4 w-20" />
      <div className="mb-5 space-y-2">
        <Skeleton className="h-7 w-72" />
        <div className="flex items-center gap-2">
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-1.5 w-1.5 rounded-full" />
            ))}
          </div>
          <Skeleton className="h-5 w-14 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16 rounded" />
            <Skeleton className="h-8 w-20 rounded" />
            <Skeleton className="h-8 w-16 rounded" />
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className={cn("h-4", i % 3 === 2 ? "w-3/4" : "w-full")} />
          ))}
        </div>
        <div className="space-y-3">
          <div className="rounded border border-border p-4">
            <Skeleton className="mb-3 h-3 w-28" />
            <Skeleton className="mb-2 h-8 w-full rounded" />
            <Skeleton className="mb-2 h-[300px] w-full rounded" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
          <div className="rounded border border-border p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
