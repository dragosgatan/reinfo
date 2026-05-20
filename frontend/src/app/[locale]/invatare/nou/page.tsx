"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { Link } from "@/i18n/navigation";

export default function NouLectiePage() {
  const t = useTranslations("learning");
  const { user, isLoading } = useAuth();

  if (isLoading) return null;

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">
          {t("permissionDeniedAdd")}
        </p>
        <Link href="/invatare" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToLearning")}
        </Link>
      </div>
    );
  }

  return <LessonEditor />;
}