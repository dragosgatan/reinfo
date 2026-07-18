"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ContestListResponseSchema } from "@/lib/types";
import type { ContestSummary, ContestStatus } from "@/lib/types";
import { ContestStatusBadge } from "@/components/contests/contest-status-badge";

type Tab = ContestStatus | "all";

const TABS: { value: Tab; labelKey: string }[] = [
  { value: "all", labelKey: "all" },
  { value: "ongoing", labelKey: "ongoing" },
  { value: "upcoming", labelKey: "upcoming" },
  { value: "past", labelKey: "past" },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ConcursuriClient() {
  const t = useTranslations("contests");
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["contests", activeTab],
    queryFn: () =>
      api.get(
        `/api/contests/?per_page=50${activeTab !== "all" ? `&status=${activeTab}` : ""}`,
        ContestListResponseSchema,
      ),
  });

  const contests: ContestSummary[] = data?.items ?? [];
  const canCreate =
    user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {canCreate && (
          <Link href="/concursuri/nou">
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              {t("createContest")}
            </Button>
          </Link>
        )}
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(tab.labelKey as Parameters<typeof t>[0])}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("description")}
        </div>
      ) : contests.length === 0 ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t("noContests")}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("create.name")}</TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("create.startTime")}
              </TableHead>
              <TableHead className="hidden sm:table-cell">
                {t("create.endTime")}
              </TableHead>
              <TableHead className="text-right">{t("participants")}</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contests.map((c) => (
              <TableRow key={c.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/concursuri/${c.slug}`}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <ContestStatusBadge status={c.status} />
                  </div>
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDate(c.start_time)}
                </TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {formatDate(c.end_time)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {c.participant_count}
                </TableCell>
                <TableCell className="text-right">
                  <Link href={`/concursuri/${c.slug}`}>
                    <Button size="sm" variant="ghost">
                      →
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
