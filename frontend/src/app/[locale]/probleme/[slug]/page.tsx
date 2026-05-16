import type { Metadata } from "next";
import { Suspense } from "react";
import { ProblemDetailClient } from "@/components/problems/problem-detail-client";
import { ProblemDetailSkeleton } from "@/components/skeletons/problem-detail-skeleton";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/problems/${slug}`, {
      next: { revalidate: 60 },
    });
    if (res.ok) {
      const data = (await res.json()) as { title: string };
      return { title: data.title };
    }
  } catch {
    // fall through
  }

  return { title: slug };
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;

  return (
    <Suspense fallback={<ProblemDetailSkeleton />}>
      <ProblemDetailClient slug={slug} />
    </Suspense>
  );
}
