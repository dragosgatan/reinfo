import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminClient } from "./admin-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("metaTitle") };
}

export default function AdminPage() {
  return <AdminClient />;
}
