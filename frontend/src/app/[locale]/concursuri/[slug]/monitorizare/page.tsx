import type { Metadata } from "next";
import { Suspense } from "react";
import MonitorizareClient from "./monitorizare-client";

export const metadata: Metadata = { title: "Monitorizare concurs" };

export default async function MonitorizarePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <Suspense>
      <MonitorizareClient slug={slug} />
    </Suspense>
  );
}
