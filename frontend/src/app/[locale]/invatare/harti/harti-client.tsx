"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Map, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { RoadmapListResponseSchema, type RoadmapSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CreateRoadmapDialog } from "@/components/roadmap/admin/CreateRoadmapDialog";

export default function HartiClient() {
  const t = useTranslations("roadmaps");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superuser";
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  function handleCreated(slug?: string) {
    setShowCreate(false);
    if (slug) router.push(`/invatare/harti/${slug}`);
  }

  const { data, isLoading, isError } = useQuery({
    queryKey: ["roadmaps"],
    queryFn: () => api.get("/api/roadmaps", RoadmapListResponseSchema),
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">
        {t("noRoadmaps")}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
            aria-label={t("admin.addRoadmap")}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("admin.addRoadmap")}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : (data?.items ?? []).length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">{t("noRoadmaps")}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(data?.items ?? []).map((roadmap) => (
            <RoadmapCard key={roadmap.id} roadmap={roadmap} isAdmin={isAdmin} />
          ))}
        </div>
      )}

      <CreateRoadmapDialog open={showCreate} onClose={handleCreated} />
    </div>
  );
}

function RoadmapCard({
  roadmap,
  isAdmin,
}: {
  roadmap: RoadmapSummary;
  isAdmin: boolean;
}) {
  const t = useTranslations("roadmaps");
  const pct = roadmap.completion_pct;

  return (
    <Link
      href={`/invatare/harti/${roadmap.slug}`}
      className={cn(
        "group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-all",
        "hover:border-foreground/20 hover:shadow-sm",
        !roadmap.is_published && "opacity-60",
      )}
      aria-label={roadmap.title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {roadmap.icon ? (
            <span className="text-xl" aria-hidden="true">
              {roadmap.icon}
            </span>
          ) : (
            <Map className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="font-medium leading-snug">{roadmap.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {isAdmin && !roadmap.is_published && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("draft")}
            </span>
          )}
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>

      {roadmap.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{roadmap.description}</p>
      )}

      <div className="mt-auto space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {roadmap.completed_nodes}/{roadmap.total_nodes} {t("nodes")}
          </span>
          <span>{pct}%</span>
        </div>
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-foreground transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
