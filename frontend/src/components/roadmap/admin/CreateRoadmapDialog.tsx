"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { api } from "@/lib/api";
import { RoadmapDetailSchema } from "@/lib/types";
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
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: (newSlug?: string) => void;
}

function toSlug(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CreateRoadmapDialog({ open, onClose }: Props) {
  const t = useTranslations("roadmaps");
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.post(
        "/api/roadmaps",
        { title, slug, description: description || null, icon: icon || null },
        RoadmapDetailSchema,
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["roadmaps"] });
      toast.success("Harta a fost creată");
      onClose(data.slug);
    },
    onError: (err: unknown) => {
      toast.error((err as { detail?: string })?.detail ?? "Eroare la creare");
    },
  });

  const handleTitleChange = (v: string) => {
    setTitle(v);
    setSlug(toSlug(v));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) return;
    mutation.mutate();
  };

  const handleClose = () => {
    setTitle("");
    setSlug("");
    setDescription("");
    setIcon("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("admin.addRoadmap")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rm-title">{t("admin.form.title")}</Label>
            <Input
              id="rm-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="ex. Începător"
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-slug">{t("admin.form.slug")}</Label>
            <Input
              id="rm-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="ex. incepator"
              pattern="^[a-z0-9-]+$"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-icon">{t("admin.form.icon")}</Label>
            <Input
              id="rm-icon"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder="🗺️"
              maxLength={4}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rm-desc">{t("admin.form.description")}</Label>
            <textarea
              id="rm-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Descriere scurtă..."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              {t("admin.form.cancel")}
            </Button>
            <Button type="submit" disabled={mutation.isPending || !title || !slug}>
              {mutation.isPending ? "Se creează..." : t("admin.form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
