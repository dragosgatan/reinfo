"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ContestDetailSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditeazaConcursPage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;
  const t = useTranslations("contests");
  const { user } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: contest, isLoading } = useQuery({
    queryKey: ["contest", slug],
    queryFn: () => api.get(`/api/contests/${slug}`, ContestDetailSchema),
  });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (contest) {
      setTitle(contest.title);
      setDescription(contest.description_md ?? "");
      setStartTime(toLocalDatetime(contest.start_time));
      setEndTime(toLocalDatetime(contest.end_time));
    }
  }, [contest]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      api.patch(`/api/contests/${slug}`, data, ContestDetailSchema),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["contest", slug] });
      toast.success("Concursul a fost actualizat.");
      router.push(`/concursuri/${updated.slug}`);
    },
    onError: (err) => {
      const detail = err instanceof ApiError ? err.detail : t("edit.errorGeneric");
      toast.error(detail);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/api/contests/${slug}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["contest", slug] });
      toast.success("Concursul a fost șters.");
      router.push("/concursuri");
    },
    onError: (err) => {
      const detail = err instanceof ApiError ? err.detail : t("edit.errorGeneric");
      toast.error(detail);
    },
  });

  if (isLoading) return null;

  if (!contest) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Concursul nu a fost găsit.
      </div>
    );
  }

  const canEdit =
    user?.role === "admin" ||
    (user?.role === "teacher" && contest.created_by === user?.id);

  if (!canEdit) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-sm text-muted-foreground">
        Permisiuni insuficiente.
      </div>
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    updateMutation.mutate({
      title,
      description_md: description || null,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    });
  }

  function handleDelete() {
    if (window.confirm(t("edit.confirmDelete"))) {
      deleteMutation.mutate();
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8 sm:px-6">
      <div className="mb-6">
        <Link
          href={`/concursuri/${slug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {contest.title}
        </Link>
      </div>

      <h1 className="mb-6 text-2xl font-semibold tracking-tight">{t("edit.title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="title">{t("create.name")}</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">{t("create.description")}</Label>
          <textarea
            id="description"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
            rows={4}
            className="flex min-h-[80px] w-full rounded border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="start">{t("create.startTime")}</Label>
            <Input
              id="start"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end">{t("create.endTime")}</Label>
            <Input
              id="end"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
            {updateMutation.isPending ? "Se salvează..." : t("edit.save")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
          >
            {t("edit.delete")}
          </Button>
        </div>
      </form>
    </div>
  );
}
