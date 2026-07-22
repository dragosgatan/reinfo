"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Pin, PinOff, Pencil, Trash2, Plus, X, Check } from "lucide-react";
import { z } from "zod";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { AnnouncementReadSchema, type AnnouncementRead } from "@/lib/types";
import { resolveMediaUrl, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  classId: string;
  isTeacher: boolean;
}

export function AnnouncementsTab({ classId, isTeacher }: Props) {
  const t = useTranslations("classroom.announcements");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [form, setForm] = useState({ title: "", body_md: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ title: "", body_md: "" });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["announcements", classId],
    queryFn: () => api.get(`/api/classes/${classId}/announcements`, z.array(AnnouncementReadSchema)),
    staleTime: 30_000,
  });

  async function handleCreate() {
    if (!form.title.trim() || !form.body_md.trim()) return;
    try {
      const ann = await api.post<AnnouncementRead>(`/api/classes/${classId}/announcements`, form);
      queryClient.setQueryData<AnnouncementRead[]>(["announcements", classId], (prev) =>
        prev ? [ann, ...prev] : [ann],
      );
      setForm({ title: "", body_md: "" });
      setComposing(false);
      toast.success(t("published"));
    } catch {
      toast.error(t("errorPublishing"));
    }
  }

  async function handleDelete(id: string) {
    try {
      await api.delete(`/api/classes/${classId}/announcements/${id}`);
      queryClient.setQueryData<AnnouncementRead[]>(["announcements", classId], (prev) =>
        prev?.filter((a) => a.id !== id),
      );
      toast.success(t("deleted"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handlePin(ann: AnnouncementRead) {
    try {
      const updated = await api.patch<AnnouncementRead>(
        `/api/classes/${classId}/announcements/${ann.id}`,
        { pinned: !ann.pinned },
      );
      queryClient.setQueryData<AnnouncementRead[]>(["announcements", classId], (prev) =>
        prev?.map((a) => (a.id === ann.id ? updated : a)),
      );
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleEdit(id: string) {
    try {
      const updated = await api.patch<AnnouncementRead>(
        `/api/classes/${classId}/announcements/${id}`,
        { title: editForm.title, body_md: editForm.body_md },
      );
      queryClient.setQueryData<AnnouncementRead[]>(["announcements", classId], (prev) =>
        prev?.map((a) => (a.id === id ? updated : a)),
      );
      setEditingId(null);
      toast.success(t("updated"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  if (isLoading) {
    return <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-24 rounded-md bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {isTeacher && !composing && (
        <Button size="sm" onClick={() => setComposing(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          {t("new")}
        </Button>
      )}

      {composing && (
        <div className="rounded-md border border-border p-4 space-y-3">
          <Input
            placeholder={t("titlePlaceholder")}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full min-h-[120px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            placeholder={t("contentPlaceholder")}
            value={form.body_md}
            onChange={(e) => setForm((f) => ({ ...f, body_md: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreate}>{t("publish")}</Button>
            <Button size="sm" variant="outline" onClick={() => { setComposing(false); setForm({ title: "", body_md: "" }); }}>
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      )}

      {announcements.length === 0 && !composing && (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("noAnnouncements")}</p>
      )}

      {announcements.map((ann) => (
        <div
          key={ann.id}
          className={cn("rounded-md border border-border p-4", ann.pinned && "border-primary/40 bg-primary/5")}
        >
          {editingId === ann.id ? (
            <div className="space-y-3">
              <Input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} />
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                value={editForm.body_md}
                onChange={(e) => setEditForm((f) => ({ ...f, body_md: e.target.value }))}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleEdit(ann.id)}><Check className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => setEditingId(null)}><X className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {ann.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  <h3 className="font-semibold leading-snug truncate">{ann.title}</h3>
                </div>
                {isTeacher && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handlePin(ann)} title={ann.pinned ? t("unpin") : t("pin")}>
                      {ann.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(ann.id); setEditForm({ title: ann.title, body_md: ann.body_md }); }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(ann.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <MarkdownContent markdown={ann.body_md} />
              <div className="mt-3 flex items-center gap-2">
                <Avatar className="h-5 w-5">
                  {ann.author_avatar_url && <AvatarImage src={resolveMediaUrl(ann.author_avatar_url)} />}
                  <AvatarFallback className="text-[9px]">{ann.author_username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-xs text-muted-foreground">{ann.author_display_name} · {formatDate(ann.created_at)}</span>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}