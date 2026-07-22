"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronRight, ListChecks, Plus, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { TRACK_OLYMPIADS, TrackListResponseSchema } from "@/lib/types";
import type { TrackOlympiad, TrackSummary } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 128);
}

export default function PregatireClient() {
  const t = useTranslations("tracks");
  const { user } = useAuth();
  const canAuthor = user?.role === "teacher" || user?.role === "admin" || user?.role === "superuser";
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["tracks"],
    queryFn: () => api.get("/api/tracks", TrackListResponseSchema),
  });

  if (isError) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">
        {t("noTracks")}
      </div>
    );
  }

  const grouped = new Map<TrackOlympiad, TrackSummary[]>();
  for (const track of data?.items ?? []) {
    const list = grouped.get(track.olympiad) ?? [];
    list.push(track);
    grouped.set(track.olympiad, list);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canAuthor && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            {t("addTrack")}
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
        <p className="text-center text-sm text-muted-foreground">{t("noTracks")}</p>
      ) : (
        <div className="space-y-8">
          {TRACK_OLYMPIADS.filter((o) => grouped.has(o)).map((olympiad) => (
            <div key={olympiad}>
              <h2 className="mb-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {olympiad}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.get(olympiad)!.map((track) => (
                  <TrackCard key={track.id} track={track} canAuthor={canAuthor} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateTrackDialog
        open={showCreate}
        onClose={(slug) => {
          setShowCreate(false);
          if (slug) router.push(`/pregatire/${slug}`);
        }}
      />
    </div>
  );
}

function TrackCard({ track, canAuthor }: { track: TrackSummary; canAuthor: boolean }) {
  const t = useTranslations("tracks");
  const pct = track.completion_pct;

  return (
    <Link
      href={`/pregatire/${track.slug}` as Parameters<typeof Link>[0]["href"]}
      className={cn(
        "group relative flex flex-col gap-4 rounded-lg border border-border bg-card p-5 transition-all",
        "hover:border-foreground/20 hover:shadow-sm",
        !track.published && "opacity-60",
      )}
      aria-label={track.title}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium leading-snug">{track.title}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {canAuthor && !track.published && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t("draft")}
            </span>
          )}
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </div>
      </div>

      <div className="mt-auto space-y-1.5">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {track.item_count} {t("steps")}
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

function CreateTrackDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: (slug?: string) => void;
}) {
  const t = useTranslations("tracks");
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [olympiad, setOlympiad] = useState<TrackOlympiad>("ONI");
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!title.trim() || !slug.trim()) return;
    setSubmitting(true);
    try {
      const track = await api.post<TrackSummary>("/api/tracks", {
        title,
        slug,
        olympiad,
        published: false,
      });
      await queryClient.invalidateQueries({ queryKey: ["tracks"] });
      setTitle("");
      setSlug("");
      onClose(track.slug);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("addTrack")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="track-title">{t("titleLabel")}</Label>
            <Input
              id="track-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (!slug || slug === slugify(title)) setSlug(slugify(e.target.value));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="track-slug">{t("slugLabel")}</Label>
            <Input
              id="track-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t("olympiadLabel")}</Label>
            <Select value={olympiad} onValueChange={(v) => setOlympiad(v as TrackOlympiad)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRACK_OLYMPIADS.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onClose()}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={handleCreate} disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {t("create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
