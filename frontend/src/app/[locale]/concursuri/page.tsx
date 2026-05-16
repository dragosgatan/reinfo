import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ConcursuriClient from "./concursuri-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contests");
  return { title: t("title") };
}

export default function ConcursuriPage() {
  return (
    <Suspense fallback={<ContestListSkeleton />}>
      <ConcursuriClient />
    </Suspense>
  );
}

function ContestListSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="mb-6 h-8 w-48" />
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
