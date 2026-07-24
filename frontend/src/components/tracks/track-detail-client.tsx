"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Code2,
  Flag,
  Loader2,
  Lock,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { TrackDetailSchema } from "@/lib/types";
import type { TrackItem, TrackItemType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
}

const ITEM_CONTENT_PATH: Record<TrackItemType, (slug: string) => string> = {
  lesson: (slug) => `/invatare/${slug}`,
  problem: (slug) => `/probleme/${slug}`,
  ctf_challenge: (slug) => `/ctf/${slug}`,
};

const ITEM_ICON: Record<TrackItemType, typeof BookOpen> = {
  lesson: BookOpen,
  problem: Code2,
  ctf_challenge: Flag,
};

export function TrackDetailClient({ slug }: Props) {
  const t = useTranslations("tracks");
  const { user, isAuthenticated } = useAuth();
  const [manageMode, setManageMode] = useState(false);

  const {
    data: track,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["track", slug],
    queryFn: () => api.get(`/api/tracks/${slug}`, TrackDetailSchema),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (isLoading) return null;

  if (error || !track) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">{t("notFound")}</p>
        <Link href="/pregatire" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToTracks")}
        </Link>
      </div>
    );
  }

  const canAuthor = user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <Link
        href="/pregatire"
        className="mb-4 inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        {t("backToTracks")}
      </Link>

      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{track.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="muted">{track.olympiad}</Badge>
            <Badge variant="muted">{t(`audience.${track.audience}`)}</Badge>
            <span>
              {track.completed_items}/{track.item_count} {t("steps")}
            </span>
            <span className="font-mono font-semibold text-foreground">
              {track.completion_pct}%
            </span>
          </div>
        </div>
        {canAuthor && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setManageMode((v) => !v)}
            className="gap-1.5"
          >
            <Settings className="h-3.5 w-3.5" aria-hidden="true" />
            {manageMode ? t("exitManage") : t("manage")}
          </Button>
        )}
      </div>

      {track.description_md && (
        <div className="mb-5">
          <MarkdownContent markdown={track.description_md} />
        </div>
      )}

      <div className="mt-5 space-y-2">
        {track.items.map((item) => (
          <TrackItemRow
            key={item.id}
            trackSlug={slug}
            item={item}
            isAuthenticated={isAuthenticated}
            manageMode={manageMode}
          />
        ))}
        {track.items.length === 0 && (
          <p className="rounded border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {t("noItems")}
          </p>
        )}
      </div>

      {manageMode && <AddItemForm trackSlug={slug} items={track.items} />}
    </div>
  );
}

function TrackItemRow({
  trackSlug,
  item,
  isAuthenticated,
  manageMode,
}: {
  trackSlug: string;
  item: TrackItem;
  isAuthenticated: boolean;
  manageMode: boolean;
}) {
  const t = useTranslations("tracks");
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(false);
  const Icon = ITEM_ICON[item.item_type];
  const locked = item.unlock_status === "locked";

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["track", trackSlug] });
    queryClient.invalidateQueries({ queryKey: ["tracks"] });
  };

  async function setStatus(status: "in_progress" | "done" | "not_started") {
    setUpdating(true);
    try {
      await api.put(`/api/tracks/${trackSlug}/items/${item.id}/progress`, { status });
      invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    try {
      await api.delete(`/api/tracks/${trackSlug}/items/${item.id}`);
      invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    }
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded border border-border p-3",
        locked && "opacity-60",
      )}
    >
      <div className="shrink-0">
        {item.unlock_status === "done" ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
        ) : locked ? (
          <Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        ) : (
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {locked || !item.ref_slug ? (
          <span className="text-sm text-muted-foreground">{item.ref_title}</span>
        ) : (
          <Link
            href={ITEM_CONTENT_PATH[item.item_type](item.ref_slug) as Parameters<typeof Link>[0]["href"]}
            className="text-sm font-medium hover:text-primary"
          >
            {item.ref_title}
          </Link>
        )}
        <p className="text-[11px] text-muted-foreground">{t(`itemType.${item.item_type}`)}</p>
      </div>

      {isAuthenticated && !locked && (
        <div className="flex shrink-0 items-center gap-1.5">
          {item.status !== "done" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={updating}
              onClick={() => setStatus(item.status === "not_started" ? "in_progress" : "done")}
            >
              {updating && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              {item.status === "not_started" ? t("start") : t("markDone")}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              disabled={updating}
              onClick={() => setStatus("not_started")}
            >
              {t("reset")}
            </Button>
          )}
        </div>
      )}

      {manageMode && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function AddItemForm({ trackSlug, items }: { trackSlug: string; items: TrackItem[] }) {
  const t = useTranslations("tracks");
  const queryClient = useQueryClient();
  const [itemType, setItemType] = useState<TrackItemType>("lesson");
  const [contentSlug, setContentSlug] = useState("");
  const [prerequisiteId, setPrerequisiteId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const lookupPath: Record<TrackItemType, (slug: string) => string> = {
    lesson: (slug) => `/api/lessons/${slug}`,
    problem: (slug) => `/api/problems/${slug}`,
    ctf_challenge: (slug) => `/api/ctf/${slug}`,
  };

  async function handleAdd() {
    if (!contentSlug.trim()) return;
    setSubmitting(true);
    try {
      const resolved = await api.get<{ id: string }>(lookupPath[itemType](contentSlug.trim()));
      await api.post(`/api/tracks/${trackSlug}/items`, {
        item_type: itemType,
        ref_id: resolved.id,
        order: items.length,
        prerequisite_item_id: prerequisiteId || null,
      });
      setContentSlug("");
      setPrerequisiteId("");
      await queryClient.invalidateQueries({ queryKey: ["track", trackSlug] });
    } catch (err) {
      toast.error(
        err instanceof ApiError && err.status === 404
          ? t("contentNotFound")
          : err instanceof ApiError
            ? err.message
            : t("errorGeneric"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 rounded border border-dashed border-border p-4">
      <Label className="mb-2 block text-xs uppercase tracking-wider text-muted-foreground">
        {t("addItem")}
      </Label>
      <div className="grid gap-2 sm:grid-cols-[140px_1fr_1fr_auto]">
        <Select value={itemType} onValueChange={(v) => setItemType(v as TrackItemType)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="lesson">{t("itemType.lesson")}</SelectItem>
            <SelectItem value="problem">{t("itemType.problem")}</SelectItem>
            <SelectItem value="ctf_challenge">{t("itemType.ctf_challenge")}</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={contentSlug}
          onChange={(e) => setContentSlug(e.target.value)}
          placeholder={t("contentSlugPlaceholder")}
          className="h-9 font-mono text-sm"
        />
        <Select
          value={prerequisiteId || "none"}
          onValueChange={(v) => setPrerequisiteId(v === "none" ? "" : v)}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder={t("prerequisiteLabel")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("noPrerequisite")}</SelectItem>
            {items.map((it) => (
              <SelectItem key={it.id} value={it.id}>
                {it.ref_title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={handleAdd} disabled={submitting} className="h-9">
          {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}
