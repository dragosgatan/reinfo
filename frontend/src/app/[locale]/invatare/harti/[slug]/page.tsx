import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import RoadmapDetailClient from "./roadmap-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("roadmaps");
  return { title: t("title") };
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Skeleton className="mb-6 h-8 w-64" />
      <Skeleton className="h-[500px] rounded-lg" />
    </div>
  );
}

export default function RoadmapDetailPage({ params }: { params: { slug: string } }) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <RoadmapDetailClient slug={params.slug} />
    </Suspense>
  );
}
