import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { privacyPolicy, type LegalLocale } from "@/lib/legal-content";

interface PageProps {
  params: Promise<{ locale: string }>;
}

function resolveDoc(locale: string) {
  const key: LegalLocale = locale === "en" || locale === "hu" ? locale : "ro";
  return privacyPolicy[key];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params;
  return { title: resolveDoc(locale).title };
}

export default async function PrivacyPolicyPage({ params }: PageProps) {
  const { locale } = await params;
  return <LegalDocument doc={resolveDoc(locale)} />;
}
