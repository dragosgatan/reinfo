"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  ExternalLink,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { NodeProgressSchema, type NodeStatus, type RoadmapNode } from "@/lib/types";
import { cn } from "@/lib/utils";

const STATUS_ICONS: Record<NodeStatus, React.ReactNode> = {
  not_started: <Circle className="h-4 w-4" />,
  in_progress: <Clock className="h-4 w-4" />,
  done: <CheckCircle2 className="h-4 w-4" />,
};

const STATUS_COLORS: Record<NodeStatus, string> = {
  not_started: "text-muted-foreground",
  in_progress: "text-amber-600 dark:text-amber-400",
  done: "text-emerald-600 dark:text-emerald-400",
};

const LINK_ICONS: Record<string, React.ReactNode> = {
  problem: <BookOpen className="h-3.5 w-3.5" />,
  material: <BookOpen className="h-3.5 w-3.5" />,
  external: <ExternalLink className="h-3.5 w-3.5" />,
};

interface Props {
  node: RoadmapNode;
  slug: string;
  isAdmin: boolean;
  editMode: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function NodeSheet({ node, slug, isAdmin, editMode, onClose, onEdit, onDelete }: Props) {
  const t = useTranslations("roadmaps");
  const queryClient = useQueryClient();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const progressMutation = useMutation({
    mutationFn: (status: NodeStatus) =>
      api.put(
        `/api/roadmaps/${slug}/nodes/${node.id}/progress`,
        { status },
        NodeProgressSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
      queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
    },
  });

  const currentStatus: NodeStatus = node.progress?.status ?? "not_started";
  const statuses: NodeStatus[] = ["not_started", "in_progress", "done"];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={node.title}
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col border-l border-border bg-background shadow-xl"
      >
        <div className="flex items-start justify-between gap-2 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold leading-snug">{node.title}</h2>
          <div className="flex shrink-0 items-center gap-1">
            {isAdmin && editMode && (
              <>
                <button
                  onClick={onEdit}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Editează nodul"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Ștergi nodul "${node.title}"?`)) onDelete();
                  }}
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label="Șterge nodul"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            <button
              ref={closeRef}
              onClick={onClose}
              className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("nodeSheet.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section aria-labelledby="desc-heading">
            <h3
              id="desc-heading"
              className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {t("nodeSheet.description")}
            </h3>
            {node.description ? (
              <p className="text-sm leading-relaxed">{node.description}</p>
            ) : (
              <p className="text-sm text-muted-foreground">{t("nodeSheet.noDescription")}</p>
            )}
          </section>

          <section aria-labelledby="links-heading">
            <h3
              id="links-heading"
              className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {t("nodeSheet.links")}
            </h3>
            {node.links.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("nodeSheet.noLinks")}</p>
            ) : (
              <ul className="space-y-1.5">
                {node.links.map((link) => (
                  <li key={link.id}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs transition-colors hover:border-foreground/20 hover:bg-muted/50"
                    >
                      <span className="shrink-0 text-muted-foreground">
                        {LINK_ICONS[link.link_type]}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{link.title}</span>
                      <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="status-heading">
            <h3
              id="status-heading"
              className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
            >
              {t("nodeSheet.statusLabel")}
            </h3>
            <div className="flex flex-col gap-1.5">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => progressMutation.mutate(status)}
                  disabled={progressMutation.isPending}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md border px-3 py-2.5 text-xs font-medium transition-all",
                    currentStatus === status
                      ? "border-foreground/30 bg-foreground/5"
                      : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                    STATUS_COLORS[status],
                  )}
                  aria-pressed={currentStatus === status}
                >
                  <span
                    className={cn(
                      currentStatus === status ? STATUS_COLORS[status] : "text-muted-foreground",
                    )}
                  >
                    {STATUS_ICONS[status]}
                  </span>
                  {t(`status.${status}` as Parameters<typeof t>[0])}
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
