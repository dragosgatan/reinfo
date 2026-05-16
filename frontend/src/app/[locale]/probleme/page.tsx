import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ProblemListSkeleton } from "@/components/skeletons/problem-list-skeleton";
import ProblemeClient from "./probleme-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("problems");
  return { title: t("title") };
}

export default function ProblemePage() {
  return (
    <Suspense fallback={<ProblemListSkeleton />}>
      <ProblemeClient />
    </Suspense>
  );
}
