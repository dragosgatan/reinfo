import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { SubmisiiClient } from "./submisii-client";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("submissions");
  return { title: t("title") };
}

function SubmisiiSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <Skeleton className="mb-6 h-7 w-40" />
      <div className="mb-4 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-28 rounded" />
        ))}
      </div>
      <div className="space-y-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded" />
        ))}
      </div>
    </div>
  );
}

export default function SubmisiiPage() {
  return (
    <Suspense fallback={<SubmisiiSkeleton />}>
      <SubmisiiClient />
    </Suspense>
  );
}
