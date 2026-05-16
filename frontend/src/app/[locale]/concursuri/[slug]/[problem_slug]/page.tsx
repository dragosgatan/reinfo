import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ContestProblemClient from "./contest-problem-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; problem_slug: string }>;
}): Promise<Metadata> {
  const { problem_slug } = await params;
  return { title: problem_slug };
}

export default async function ContestProblemPage({
  params,
}: {
  params: Promise<{ slug: string; problem_slug: string }>;
}) {
  const { slug, problem_slug } = await params;
  return (
    <Suspense fallback={<ProblemSkeleton />}>
      <ContestProblemClient contestSlug={slug} problemSlug={problem_slug} />
    </Suspense>
  );
}

function ProblemSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
