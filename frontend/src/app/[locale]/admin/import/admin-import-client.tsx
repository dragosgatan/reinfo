"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BulkImportProblems } from "@/components/admin/bulk-import-problems";
import { BulkImportLessons } from "@/components/admin/bulk-import-lessons";

type Tab = "probleme" | "lectii";

export function AdminImportClient() {
  const t = useTranslations("admin");
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>("probleme");

  const isPrivileged = user?.role === "admin" || user?.role === "superuser";

  useEffect(() => {
    if (!authLoading && !isPrivileged) {
      router.replace("/");
    }
  }, [authLoading, isPrivileged, router]);

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <Skeleton className="h-64 rounded" />
      </div>
    );
  }

  if (!isPrivileged) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-6 border-b border-border pb-4">
        <Link href="/admin" className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground">
          {t("backToAdmin")}
        </Link>
        <h1 className="text-xl font-bold tracking-tight">{t("importTitle")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("importSubtitle")}</p>
      </div>

      <div className="mb-5 flex gap-1 border-b border-border">
        <button
          type="button"
          onClick={() => setTab("probleme")}
          className={cn(
            "px-3 py-2 text-sm transition-colors",
            tab === "probleme"
              ? "border-b-2 border-primary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("importTabProblems")}
        </button>
        <button
          type="button"
          onClick={() => setTab("lectii")}
          className={cn(
            "px-3 py-2 text-sm transition-colors",
            tab === "lectii"
              ? "border-b-2 border-primary font-medium text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t("importTabLessons")}
        </button>
      </div>

      {tab === "probleme" ? <BulkImportProblems /> : <BulkImportLessons />}
    </div>
  );
}
