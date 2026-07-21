"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, LogIn, Users, BookOpen } from "lucide-react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { ClassReadSchema, type ClassRead } from "@/lib/types";
import { resolveMediaUrl } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { useRouter } from "@/i18n/navigation";

export function ClassesClient() {
  const { user } = useAuth();
  const t = useTranslations("classes");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", description_md: "" });
  const canCreateClass =
    user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: () => api.get("/api/classes", z.array(ClassReadSchema)),
    staleTime: 30_000,
  });

  async function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    setJoining(true);
    try {
      const cls = await api.post<ClassRead>(`/api/classes/join?join_code=${code}`, {});
      queryClient.setQueryData<ClassRead[]>(["classes"], (prev) =>
        prev ? [...prev, cls] : [cls],
      );
      setJoinCode("");
      toast.success(t("joinedClass", { name: cls.name }));
      router.push(`/clase/${cls.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("invalidCode"));
    } finally {
      setJoining(false);
    }
  }

  async function handleCreate() {
    if (!form.name.trim()) return;
    try {
      const cls = await api.post<ClassRead>("/api/classes", {
        name: form.name.trim(),
        description_md: form.description_md || null,
      });
      queryClient.setQueryData<ClassRead[]>(["classes"], (prev) =>
        prev ? [...prev, cls] : [cls],
      );
      setForm({ name: "", description_md: "" });
      setCreating(false);
      toast.success(t("classCreated"));
      router.push(`/clase/${cls.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {t("subtitle")}
          </p>
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-4 ${canCreateClass ? "sm:grid-cols-2" : ""}`}>
        <div className="rounded-md border border-border p-4 space-y-3">
          <p className="text-sm font-semibold">{t("joinWithCode")}</p>
          <div className="flex gap-2">
            <Input
              placeholder={t("inviteCodePlaceholder")}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="font-mono uppercase"
              maxLength={8}
            />
            <Button onClick={handleJoin} disabled={joining || !joinCode.trim()} className="gap-1.5 shrink-0">
              <LogIn className="h-3.5 w-3.5" />
              {t("enter")}
            </Button>
          </div>
        </div>

        {canCreateClass && (
          <div className="rounded-md border border-border p-4 space-y-3">
            <p className="text-sm font-semibold">{t("createClass")}</p>
            {!creating ? (
              <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                {t("newClass")}
              </Button>
            ) : (
              <div className="space-y-2">
                <Input
                  placeholder={t("classNamePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
                <textarea
                  className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                  placeholder={t("descriptionOptional")}
                  value={form.description_md}
                  onChange={(e) => setForm((f) => ({ ...f, description_md: e.target.value }))}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate}>{t("create")}</Button>
                  <Button size="sm" variant="outline" onClick={() => { setCreating(false); setForm({ name: "", description_md: "" }); }}>
                    {tCommon("cancel")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">{t("noClasses")}</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {classes.map((cls) => (
            <Link
              key={cls.id}
              href={`/clase/${cls.id}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{cls.name}</p>
                  {cls.archived && <Badge variant="secondary" className="text-xs">{t("archived")}</Badge>}
                  {cls.teacher_id === user?.id && <Badge variant="outline" className="text-xs">{t("teacher")}</Badge>}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      {cls.teacher_avatar_url && <AvatarImage src={resolveMediaUrl(cls.teacher_avatar_url)} />}
                      <AvatarFallback className="text-[8px]">{cls.teacher_username.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground">{cls.teacher_display_name}</span>
                  </div>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="h-3 w-3" />
                    {cls.member_count}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}