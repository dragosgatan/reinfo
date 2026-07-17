"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { RoadmapDetailSchema, type RoadmapNode } from "@/lib/types";
import { RoadmapGraph } from "@/components/roadmap/RoadmapGraph";
import { NodeSheet } from "@/components/roadmap/NodeSheet";
import { NodeDialog } from "@/components/roadmap/admin/NodeDialog";
import { EdgeDialog } from "@/components/roadmap/admin/EdgeDialog";
import { toast } from "sonner";

interface Props {
  slug: string;
}

export default function RoadmapDetailClient({ slug }: Props) {
  const t = useTranslations("roadmaps");
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "superuser";
  const queryClient = useQueryClient();
  const router = useRouter();

  const [editMode, setEditMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<RoadmapNode | null>(null);
  const [showAddNode, setShowAddNode] = useState(false);
  const [editingNode, setEditingNode] = useState<RoadmapNode | null>(null);
  const [showAddEdge, setShowAddEdge] = useState(false);

  const { data: roadmap, isLoading, isError } = useQuery({
    queryKey: ["roadmap", slug],
    queryFn: () => api.get(`/api/roadmaps/${slug}`, RoadmapDetailSchema),
  });

  const togglePublishMutation = useMutation({
    mutationFn: (published: boolean) =>
      api.patch(`/api/roadmaps/${slug}`, { is_published: published }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
      queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
    },
  });

  const deleteRoadmapMutation = useMutation({
    mutationFn: () => api.delete(`/api/roadmaps/${slug}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      router.push("/invatare/harti");
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: (nodeId: string) =>
      api.delete(`/api/roadmaps/${slug}/nodes/${nodeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
      setSelectedNode(null);
      toast.success("Nodul a fost șters");
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: (edgeId: string) =>
      api.delete(`/api/roadmaps/${slug}/edges/${edgeId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6 h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-[500px] animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (isError || !roadmap) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 text-center text-muted-foreground">
        Harta de parcurs nu a fost găsită.
      </div>
    );
  }

  const completedCount = roadmap.nodes.filter(
    (n) => n.progress?.status === "done",
  ).length;
  const pct =
    roadmap.nodes.length > 0
      ? Math.round((completedCount / roadmap.nodes.length) * 100)
      : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href="/invatare/harti"
            className="mb-2 inline-block text-xs text-muted-foreground hover:text-foreground"
          >
            {t("backToRoadmaps")}
          </Link>
          <div className="flex items-center gap-2">
            {roadmap.icon && (
              <span className="text-2xl" aria-hidden="true">
                {roadmap.icon}
              </span>
            )}
            <h1 className="text-2xl font-semibold tracking-tight">{roadmap.title}</h1>
            {isAdmin && !roadmap.is_published && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {t("draft")}
              </span>
            )}
          </div>
          {roadmap.description && (
            <p className="mt-1 text-sm text-muted-foreground">{roadmap.description}</p>
          )}
          {roadmap.nodes.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              {completedCount}/{roadmap.nodes.length} {t("nodes")} · {pct}%
            </p>
          )}
        </div>

        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                editMode
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              <Pencil className="h-3.5 w-3.5" />
              {editMode ? t("admin.exitEditMode") : t("admin.editMode")}
            </button>
            {editMode && (
              <>
                <button
                  onClick={() => setShowAddNode(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("admin.addNode")}
                </button>
                <button
                  onClick={() => setShowAddEdge(true)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("admin.addEdge")}
                </button>
                <button
                  onClick={() => togglePublishMutation.mutate(!roadmap.is_published)}
                  className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {roadmap.is_published ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      {t("admin.unpublish")}
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      {t("admin.publish")}
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        "Ești sigur că vrei să ștergi această hartă? Acțiunea este ireversibilă.",
                      )
                    ) {
                      deleteRoadmapMutation.mutate();
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("admin.deleteRoadmap")}
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <RoadmapGraph
        roadmap={roadmap}
        onNodeClick={(node) => setSelectedNode(node)}
        editMode={editMode && isAdmin}
        onEditNode={(node) => setEditingNode(node)}
        onDeleteNode={(nodeId) => deleteNodeMutation.mutate(nodeId)}
        onDeleteEdge={(edgeId) => deleteEdgeMutation.mutate(edgeId)}
        slug={slug}
      />

      {selectedNode && (
        <NodeSheet
          node={selectedNode}
          slug={slug}
          isAdmin={isAdmin}
          editMode={editMode}
          onClose={() => setSelectedNode(null)}
          onEdit={() => {
            setEditingNode(selectedNode);
            setSelectedNode(null);
          }}
          onDelete={() => deleteNodeMutation.mutate(selectedNode.id)}
        />
      )}

      {(showAddNode || editingNode) && (
        <NodeDialog
          slug={slug}
          node={editingNode ?? undefined}
          nodes={roadmap.nodes}
          open={showAddNode || editingNode !== null}
          onClose={() => {
            setShowAddNode(false);
            setEditingNode(null);
          }}
        />
      )}

      {showAddEdge && (
        <EdgeDialog
          slug={slug}
          nodes={roadmap.nodes}
          open={showAddEdge}
          onClose={() => setShowAddEdge(false)}
        />
      )}
    </div>
  );
}
