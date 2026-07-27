import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AdminImportClient } from "./admin-import-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin");
  return { title: t("importTitle") };
}

export default function AdminImportPage() {
  return <AdminImportClient />;
}
