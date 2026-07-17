"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { RoadmapEdgeSchema, type RoadmapNode } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  slug: string;
  nodes: RoadmapNode[];
  open: boolean;
  onClose: () => void;
}

export function EdgeDialog({ slug, nodes, open, onClose }: Props) {
  const t = useTranslations("roadmaps");
  const queryClient = useQueryClient();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post(
        `/api/roadmaps/${slug}/edges`,
        { from_node_id: fromId, to_node_id: toId },
        RoadmapEdgeSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
      toast.success("Conexiunea a fost adăugată");
      setFromId("");
      setToId("");
      onClose();
    },
    onError: (err: unknown) => {
      toast.error((err as { detail?: string })?.detail ?? "Eroare");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromId || !toId) return;
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("admin.addEdge")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edge-from">{t("admin.form.fromNode")}</Label>
            <Select value={fromId} onValueChange={setFromId}>
              <SelectTrigger id="edge-from">
                <SelectValue placeholder="Selectează..." />
              </SelectTrigger>
              <SelectContent>
                {nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edge-to">{t("admin.form.toNode")}</Label>
            <Select value={toId} onValueChange={setToId}>
              <SelectTrigger id="edge-to">
                <SelectValue placeholder="Selectează..." />
              </SelectTrigger>
              <SelectContent>
                {nodes
                  .filter((n) => n.id !== fromId)
                  .map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("admin.form.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending || !fromId || !toId || fromId === toId}
            >
              {mutation.isPending ? "Se adaugă..." : t("admin.form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
