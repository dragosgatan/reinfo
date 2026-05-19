"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ExternalLink, Clock, CheckCircle2, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { ClassTestReadSchema, type ClassTestRead } from "@/lib/types";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { z } from "zod";

interface Props {
  classId: string;
  isTeacher: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Planificat",
  ongoing: "Activ",
  past: "Încheiat",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={status === "ongoing" ? "default" : status === "upcoming" ? "secondary" : "outline"}
      className="text-xs"
    >
      {status === "ongoing" && <Timer className="mr-1 h-3 w-3" />}
      {status === "upcoming" && <Clock className="mr-1 h-3 w-3" />}
      {status === "past" && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function formatDt(iso: string) {
  return new Date(iso).toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TestsTab({ classId, isTeacher }: Props) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [fullscreen, setFullscreen] = useState(false);
  const [copyPaste, setCopyPaste] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: tests = [], isLoading } = useQuery({
    queryKey: ["class-tests", classId],
    queryFn: () =>
      api
        .get(`/api/classes/${classId}/tests`, z.array(ClassTestReadSchema))
        .then((r) => r),
    staleTime: 30_000,
  });

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (new Date(endTime) <= new Date(startTime)) {
      toast.error("Ora de final trebuie să fie după ora de start");
      return;
    }
    setSubmitting(true);
    try {
      const created = await api.post(
        `/api/classes/${classId}/tests`,
        {
          title,
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          fullscreen_required: fullscreen,
          copy_paste_blocked: copyPaste,
        },
        ClassTestReadSchema,
      );
      queryClient.setQueryData<ClassTestRead[]>(["class-tests", classId], (prev) =>
        [created, ...(prev ?? [])],
      );
      setTitle("");
      setStartTime("");
      setEndTime("");
      setFullscreen(false);
      setCopyPaste(false);
      setShowForm(false);
      toast.success("Test creat");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm("Ștergi definitiv acest test? Submisiile vor fi șterse.")) return;
    try {
      await api.delete(`/api/classes/${classId}/tests/${slug}`);
      queryClient.setQueryData<ClassTestRead[]>(["class-tests", classId], (prev) =>
        prev?.filter((t) => t.slug !== slug),
      );
      toast.success("Test șters");
    } catch {
      toast.error("Eroare");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isTeacher && (
        <div>
          {!showForm ? (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" />
              Test nou
            </Button>
          ) : (
            <form
              onSubmit={handleCreate}
              className="space-y-4 rounded-md border border-border p-4"
            >
              <p className="text-sm font-medium">Test nou</p>

              <div className="space-y-1.5">
                <Label htmlFor="test-title">Titlu</Label>
                <Input
                  id="test-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Test clasa a IX-a"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="test-start">Start</Label>
                  <Input
                    id="test-start"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="test-end">Final</Label>
                  <Input
                    id="test-end"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Securitate
                </p>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={fullscreen}
                    onChange={(e) => setFullscreen(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Impune ecran complet</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={copyPaste}
                    onChange={(e) => setCopyPaste(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className="text-sm">Blochează copy-paste</span>
                </label>
              </div>

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={submitting}>
                  {submitting ? "Se salvează..." : "Creează"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                >
                  Anulează
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {tests.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          {isTeacher ? "Niciun test creat încă." : "Niciun test disponibil."}
        </p>
      ) : (
        <div className="divide-y divide-border rounded-md border border-border">
          {tests.map((test) => (
            <div
              key={test.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{test.title}</span>
                  <StatusBadge status={test.status} />
                  {test.problem_count > 0 && (
                    <span className="text-xs text-muted-foreground">
                      {test.problem_count} {test.problem_count === 1 ? "problemă" : "probleme"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDt(test.start_time)} — {formatDt(test.end_time)}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button asChild size="sm" variant={test.status === "ongoing" ? "default" : "outline"}>
                  <Link href={`/concursuri/${test.slug}`} className="gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {test.status === "ongoing" ? "Intră" : "Vezi"}
                  </Link>
                </Button>
                {isTeacher && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(test.slug)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
