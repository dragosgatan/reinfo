import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import MonitorizareClient from "./monitorizare-client";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contests" });
  return { title: t("monitoring") };
}

export default async function MonitorizarePage({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense>
      <MonitorizareClient slug={slug} />
    </Suspense>
  );
}