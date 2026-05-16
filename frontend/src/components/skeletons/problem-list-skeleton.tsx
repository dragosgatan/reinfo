import { Skeleton } from "@/components/ui/skeleton";

export function ProblemListSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="mt-1 h-3.5 w-24" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-5">
          <Skeleton className="h-8 w-full rounded" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-full rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <div className="flex gap-1.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-16 rounded" />
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16" />
            <div className="flex flex-wrap gap-1">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-5 w-16 rounded" />
              ))}
            </div>
          </div>
        </aside>

        <div className="overflow-hidden rounded border border-border">
          <div className="border-b border-border bg-muted/30 px-4 py-2">
            <div className="flex gap-6">
              <Skeleton className="h-3.5 w-8" />
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3.5 w-16" />
            </div>
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-border px-4 py-3 last:border-0"
            >
              <Skeleton className="h-3.5 w-8 shrink-0 font-mono" />
              <Skeleton className="h-3.5 flex-1" />
              <Skeleton className="h-3 w-16 rounded-full" />
              <Skeleton className="hidden h-5 w-14 rounded sm:block" />
              <Skeleton className="ml-auto hidden h-3.5 w-8 md:block" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
