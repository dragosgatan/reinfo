import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { DuelClient } from "./duel-client";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Duel" };
}

export default async function DuelPage({ params }: Props) {
  const { id } = await params;
  const t = await getTranslations("duel");
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground text-sm">{t("loadingDuel")}</div>}>
      <DuelClient duelId={id} />
    </Suspense>
  );
}
