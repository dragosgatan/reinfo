import type { Metadata } from "next";
import { FriendsPageClient } from "./prieteni-client";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "friends" });
  return { title: t("friendAdded") };
}

export default function FriendsPage() {
  return <FriendsPageClient />;
}