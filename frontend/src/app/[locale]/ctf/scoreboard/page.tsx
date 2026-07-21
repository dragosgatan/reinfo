import type { Metadata } from "next";
import { Suspense } from "react";
import { CtfScoreboardClient } from "@/components/ctf/ctf-scoreboard-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Clasament CTF",
};

function ScoreboardSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-7 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

export default function CtfScoreboardPage() {
  return (
    <Suspense fallback={<ScoreboardSkeleton />}>
      <CtfScoreboardClient />
    </Suspense>
  );
}
