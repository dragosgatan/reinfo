"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowLeft, Trash2, Archive, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { ClassDetailSchema, type ClassDetail } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Link, useRouter } from "@/i18n/navigation";
import { AnnouncementsTab } from "@/components/classroom/announcements-tab";
import { AssignmentsTab } from "@/components/classroom/assignments-tab";
import { MembersTab } from "@/components/classroom/members-tab";
import { ClassChatTab } from "@/components/classroom/class-chat";
import { TestsTab } from "@/components/classroom/tests-tab";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Tab = "announcements" | "assignments" | "tests" | "members" | "chat";

interface Props {
  classId: string;
}

export function ClassDetailClient({ classId }: Props) {
  const { user } = useAuth();
  const t = useTranslations("classes");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("announcements");

  const TABS: { id: Tab; label: string }[] = [
    { id: "announcements", label: t("tabAnnouncements") },
    { id: "assignments", label: t("tabAssignments") },
    { id: "tests", label: t("tabTests") },
    { id: "members", label: t("tabMembers") },
    { id: "chat", label: t("tabChat") },
  ];

  const { data: cls, isLoading, error } = useQuery({
    queryKey: ["class", classId],
    queryFn: () => api.get(`/api/classes/${classId}`, ClassDetailSchema),
    staleTime: 30_000,
  });

  function handleClassUpdate(updated: ClassDetail) {
    queryClient.setQueryData(["class", classId], updated);
  }

  async function handleLeave() {
    if (!confirm(t("leaveConfirm"))) return;
    try {
      await api.delete(`/api/classes/${classId}/leave`);
      queryClient.setQueryData<ClassDetail[] | undefined>(["classes"], (prev) =>
        prev?.filter((c) => c.id !== classId),
      );
      toast.success(t("leftClass"));
      router.push("/clase");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    }
  }

  async function handleArchive() {
    if (!cls) return;
    try {
      const updated = await api.patch<ClassDetail>(`/api/classes/${classId}`, {
        archived: !cls.archived,
      });
      handleClassUpdate(updated);
      toast.success(cls.archived ? t("classReactivated") : t("classArchived"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleDelete() {
    if (!confirm(t("deleteConfirm"))) return;
    try {
      await api.delete(`/api/classes/${classId}`);
      queryClient.setQueryData<ClassDetail[] | undefined>(["classes"], (prev) =>
        prev?.filter((c) => c.id !== classId),
      );
      toast.success(t("classDeleted"));
      router.push("/clase");
    } catch {
      toast.error(tCommon("error"));
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
        <div className="h-8 w-48 bg-muted animate-pulse rounded" />
        <div className="h-4 w-72 bg-muted animate-pulse rounded" />
        <div className="h-64 bg-muted animate-pulse rounded-md" />
      </div>
    );
  }

  if (error || !cls) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">{t("classNotFound")}</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/clase">{t("backToClasses")}</Link>
        </Button>
      </div>
    );
  }

  const isTeacher = user?.id === cls.teacher_id;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link href="/clase">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight truncate">{cls.name}</h1>
              {cls.archived && <Badge variant="secondary">{t("archived")}</Badge>}
              {isTeacher && <Badge variant="outline">{t("teacher")}</Badge>}
            </div>
            {cls.description_md && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{cls.description_md}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isTeacher ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={handleArchive}
              >
                <Archive className="h-3.5 w-3.5" />
                {cls.archived ? t("reactivate") : t("archive")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {tCommon("delete")}
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground"
              onClick={handleLeave}
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("leave")}
            </Button>
          )}
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="flex gap-0" aria-label={t("classSections")}>
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
                tab === id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div>
        {tab === "announcements" && (
          <AnnouncementsTab classId={classId} isTeacher={isTeacher} />
        )}
        {tab === "assignments" && (
          <AssignmentsTab classId={classId} isTeacher={isTeacher} />
        )}
        {tab === "tests" && (
          <TestsTab classId={classId} isTeacher={isTeacher} />
        )}
        {tab === "members" && (
          <MembersTab cls={cls} isTeacher={isTeacher} onClassUpdate={handleClassUpdate} />
        )}
        {tab === "chat" && <ClassChatTab classId={classId} />}
      </div>
    </div>
  );
}