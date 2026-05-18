import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import InvatareClient from "./invatare-client";
import { Skeleton } from "@/components/ui/skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("learning");
  return { title: t("title") };
}

function InvatareSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="mb-6 flex gap-3">
        <Skeleton className="h-9 w-32" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="ml-auto h-9 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function InvataPage() {
  return (
    <Suspense fallback={<InvatareSkeleton />}>
      <InvatareClient />
    </Suspense>
  );
}
