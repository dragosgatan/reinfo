import type { Metadata } from "next";
import { Suspense } from "react";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
    const res = await fetch(`${apiUrl}/api/projects/${slug}`, {
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

function ProjectDetailSkeleton() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-5 h-4 w-24" />
      <Skeleton className="mb-5 h-7 w-64" />
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

export default async function ProjectPage({ params }: Props) {
  const { slug } = await params;

  return (
    <Suspense fallback={<ProjectDetailSkeleton />}>
      <ProjectDetailClient slug={slug} />
    </Suspense>
  );
}
