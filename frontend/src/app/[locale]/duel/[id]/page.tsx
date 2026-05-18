import type { Metadata } from "next";
import { Suspense } from "react";
import { DuelClient } from "./duel-client";

interface Props {
  params: Promise<{ id: string; locale: string }>;
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: "Duel" };
}

export default async function DuelPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center text-muted-foreground text-sm">Se încarcă duelul...</div>}>
      <DuelClient duelId={id} />
    </Suspense>
  );
}
