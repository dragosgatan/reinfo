"use client";

import { useRef } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RoadmapDetail, RoadmapNode } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  done: "border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  in_progress: "border-amber-400 bg-amber-400/10 text-amber-700 dark:text-amber-400",
  not_started: "border-border bg-card text-foreground",
};

const STATUS_DOT: Record<string, string> = {
  done: "bg-emerald-500",
  in_progress: "bg-amber-400",
  not_started: "bg-muted-foreground/30",
};

interface Props {
  roadmap: RoadmapDetail;
  onNodeClick: (node: RoadmapNode) => void;
  editMode?: boolean;
  onEditNode?: (node: RoadmapNode) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
  slug: string;
}

export function RoadmapGraph({
  roadmap,
  onNodeClick,
  editMode,
  onEditNode,
  onDeleteNode,
  onDeleteEdge,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { nodes, edges } = roadmap;
  const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

  if (nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
        {editMode
          ? "Nicio nod adăugat. Folosește butonul Nod nou din bara de sus."
          : "Harta de parcurs nu are noduri."}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative min-h-[500px] w-full overflow-hidden rounded-lg border border-border bg-card"
      style={{ height: "clamp(400px, 60vh, 700px)" }}
      role="region"
      aria-label="Grafic hartă de parcurs"
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="arrow-default"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" className="fill-border" />
          </marker>
          <marker
            id="arrow-done"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" className="fill-emerald-500/50" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const from = nodeMap[edge.from_node_id];
          const to = nodeMap[edge.to_node_id];
          if (!from || !to) return null;

          const fromDone = from.progress?.status === "done";
          const midY = (from.y + to.y) / 2;
          const d = `M ${from.x} ${from.y} C ${from.x} ${midY} ${to.x} ${midY} ${to.x} ${to.y}`;

          return (
            <path
              key={edge.id}
              d={d}
              strokeWidth="0.6"
              fill="none"
              markerEnd={fromDone ? "url(#arrow-done)" : "url(#arrow-default)"}
              className={cn(
                fromDone ? "stroke-emerald-500/50" : "stroke-border",
                "transition-colors",
              )}
            />
          );
        })}
      </svg>

      {editMode &&
        edges.map((edge) => {
          const from = nodeMap[edge.from_node_id];
          const to = nodeMap[edge.to_node_id];
          if (!from || !to) return null;
          const midX = (from.x + to.x) / 2;
          const midY = (from.y + to.y) / 2;

          return (
            <button
              key={`del-edge-${edge.id}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEdge?.(edge.id);
              }}
              style={{
                position: "absolute",
                left: `${midX}%`,
                top: `${midY}%`,
                transform: "translate(-50%, -50%)",
              }}
              className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
              aria-label="Șterge conexiunea"
            >
              <X className="h-3 w-3" />
            </button>
          );
        })}

      {nodes.map((node) => {
        const status = node.progress?.status ?? "not_started";

        return (
          <div
            key={node.id}
            style={{
              position: "absolute",
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: "translate(-50%, -50%)",
              maxWidth: "160px",
            }}
          >
            <button
              onClick={() => onNodeClick(node)}
              className={cn(
                "group relative flex min-w-[100px] max-w-[160px] flex-col gap-1 rounded-md border px-3 py-2 text-left text-xs font-medium shadow-sm transition-all",
                STATUS_STYLES[status],
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                "hover:shadow-md hover:scale-105",
              )}
              aria-label={`${node.title} — ${status}`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                    STATUS_DOT[status],
                  )}
                  aria-hidden="true"
                />
                <span className="line-clamp-2 leading-snug">{node.title}</span>
              </div>
            </button>

            {editMode && (
              <div className="absolute -right-1 -top-1 flex gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditNode?.(node);
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                  aria-label={`Editează ${node.title}`}
                >
                  <Pencil className="h-2.5 w-2.5" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Ștergi nodul "${node.title}"?`)) {
                      onDeleteNode?.(node.id);
                    }
                  }}
                  className="flex h-5 w-5 items-center justify-center rounded border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:border-destructive hover:text-destructive"
                  aria-label={`Șterge ${node.title}`}
                >
                  <Trash2 className="h-2.5 w-2.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
