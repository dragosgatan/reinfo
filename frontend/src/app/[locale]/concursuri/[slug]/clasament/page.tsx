import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import LeaderboardClient from "./leaderboard-client";

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Clasament" };
}

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense fallback={<LeaderboardSkeleton />}>
      <LeaderboardClient slug={slug} />
    </Suspense>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 space-y-3">
      <Skeleton className="h-8 w-48" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
