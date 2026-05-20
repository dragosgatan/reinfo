import type { Metadata } from "next";
import { Suspense } from "react";
import { SubmissionDetailClient } from "./submission-detail-client";
import { Skeleton } from "@/components/ui/skeleton";
import { getTranslations } from "next-intl/server";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, locale } = await params;
  const t = await getTranslations({ locale, namespace: "submissions" });
  return { title: t("submissionTitle", { id: id.slice(0, 8) }) };
}

function DetailSkeleton() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-6 h-4 w-28" />
      <div className="mb-6 flex flex-wrap gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-32 rounded" />
        ))}
      </div>
      <Skeleton className="mb-5 h-[400px] w-full rounded" />
      <div className="space-y-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

export default async function SubmissionDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <SubmissionDetailClient id={id} />
    </Suspense>
  );
}