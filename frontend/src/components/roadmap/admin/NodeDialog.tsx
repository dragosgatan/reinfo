"use client";

import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { NodeLinkSchema, RoadmapNodeSchema, type RoadmapNode } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
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
  node?: RoadmapNode;
  nodes: RoadmapNode[];
  open: boolean;
  onClose: () => void;
}

export function NodeDialog({ slug, node, nodes, open, onClose }: Props) {
  const t = useTranslations("roadmaps");
  const queryClient = useQueryClient();
  const isEdit = !!node;

  const [title, setTitle] = useState(node?.title ?? "");
  const [description, setDescription] = useState(node?.description ?? "");
  const [x, setX] = useState(String(node?.x ?? 50));
  const [y, setY] = useState(String(node?.y ?? 50));
  const [order, setOrder] = useState(String(node?.order ?? 0));
  const [parentId, setParentId] = useState<string>(node?.parent_id ?? "none");

  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkType, setLinkType] = useState<"problem" | "material" | "external">("external");

  useEffect(() => {
    if (open) {
      setTitle(node?.title ?? "");
      setDescription(node?.description ?? "");
      setX(String(node?.x ?? 50));
      setY(String(node?.y ?? 50));
      setOrder(String(node?.order ?? 0));
      setParentId(node?.parent_id ?? "none");
    }
  }, [open, node]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const body = {
        title,
        description: description || null,
        x: parseFloat(x),
        y: parseFloat(y),
        order: parseInt(order, 10),
        parent_id: parentId === "none" ? null : parentId,
      };
      if (isEdit) {
        return api.patch(`/api/roadmaps/${slug}/nodes/${node!.id}`, body, RoadmapNodeSchema);
      }
      return api.post(`/api/roadmaps/${slug}/nodes`, body, RoadmapNodeSchema);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
      toast.success(isEdit ? "Nodul a fost actualizat" : "Nodul a fost creat");
      onClose();
    },
    onError: (err: unknown) => {
      toast.error((err as { detail?: string })?.detail ?? "Eroare");
    },
  });

  const addLinkMutation = useMutation({
    mutationFn: () =>
      api.post(
        `/api/roadmaps/${slug}/nodes/${node!.id}/links`,
        { url: linkUrl, title: linkTitle, link_type: linkType },
        NodeLinkSchema,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
      setLinkUrl("");
      setLinkTitle("");
      toast.success("Resursa a fost adăugată");
    },
    onError: (err: unknown) =>
      toast.error((err as { detail?: string })?.detail ?? "Eroare"),
  });

  const removeLinkMutation = useMutation({
    mutationFn: (linkId: string) =>
      api.delete(`/api/roadmaps/${slug}/nodes/${node!.id}/links/${linkId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roadmap", slug] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    saveMutation.mutate();
  };

  const otherNodes = nodes.filter((n) => n.id !== node?.id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("admin.editNode") : t("admin.addNode")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nd-title">{t("admin.form.title")}</Label>
            <Input
              id="nd-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="nd-desc">{t("admin.form.description")}</Label>
            <textarea
              id="nd-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descriere..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nd-x">{t("admin.form.xPosition")}</Label>
              <Input
                id="nd-x"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={x}
                onChange={(e) => setX(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nd-y">{t("admin.form.yPosition")}</Label>
              <Input
                id="nd-y"
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={y}
                onChange={(e) => setY(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="nd-order">{t("admin.form.order")}</Label>
              <Input
                id="nd-order"
                type="number"
                min={0}
                value={order}
                onChange={(e) => setOrder(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nd-parent">{t("admin.form.parentNode")}</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger id="nd-parent">
                  <SelectValue placeholder={t("admin.form.noParent")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("admin.form.noParent")}</SelectItem>
                  {otherNodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("admin.form.cancel")}
            </Button>
            <Button type="submit" disabled={saveMutation.isPending || !title}>
              {saveMutation.isPending
                ? "Se salvează..."
                : isEdit
                  ? t("admin.form.save")
                  : t("admin.form.create")}
            </Button>
          </DialogFooter>
        </form>

        {isEdit && (
          <div className="border-t border-border pt-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {t("nodeSheet.links")}
            </h3>

            {node!.links.length > 0 && (
              <ul className="space-y-1.5">
                {node!.links.map((link) => (
                  <li
                    key={link.id}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{link.title}</span>
                    <span className="shrink-0 text-muted-foreground">{link.link_type}</span>
                    <button
                      onClick={() => removeLinkMutation.mutate(link.id)}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={`Elimină ${link.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="grid grid-cols-[1fr_auto] gap-2">
              <div className="space-y-2">
                <Input
                  placeholder={t("admin.form.linkTitle")}
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                />
                <Input
                  placeholder={t("admin.form.url")}
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  type="url"
                />
                <Select
                  value={linkType}
                  onValueChange={(v) =>
                    setLinkType(v as "problem" | "material" | "external")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="external">{t("linkType.external")}</SelectItem>
                    <SelectItem value="material">{t("linkType.material")}</SelectItem>
                    <SelectItem value="problem">{t("linkType.problem")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-end"
                onClick={() => addLinkMutation.mutate()}
                disabled={!linkUrl || !linkTitle || addLinkMutation.isPending}
                aria-label={t("admin.addLink")}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
