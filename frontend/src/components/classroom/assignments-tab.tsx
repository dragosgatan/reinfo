"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Clock,
  ChevronDown,
  ChevronRight,
  BarChart2,
  X,
  Minus,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import {
  HomeworkReadSchema,
  HomeworkProgressSchema,
  type HomeworkRead,
  type HomeworkProgress,
  type AssignmentRead,
} from "@/lib/types";
import { formatDate, resolveMediaUrl } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  classId: string;
  isTeacher: boolean;
}

function difficultyColor(d: number) {
  if (d <= 3) return "text-emerald-600 dark:text-emerald-400";
  if (d <= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function difficultyLabel(d: number) {
  if (d <= 3) return "Ușor";
  if (d <= 6) return "Mediu";
  return "Dificil";
}

function AssignmentRow({
  a,
  isTeacher,
  onRemove,
}: {
  a: AssignmentRead;
  isTeacher: boolean;
  onRemove?: () => void;
}) {
  const overdue = a.due_at && new Date(a.due_at) < new Date() && !a.user_solved;
  return (
    <div className="flex items-center gap-3 py-2 px-3 hover:bg-muted/20 transition-colors rounded">
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
          a.user_solved
            ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600"
            : "bg-muted border-border text-muted-foreground",
        )}
      >
        {a.user_solved && <Check className="h-3 w-3" />}
      </div>
      <div className="flex-1 min-w-0">
        <Link
          href={`/probleme/${a.problem_slug}`}
          className="text-sm font-medium hover:underline truncate block"
        >
          {a.problem_title}
        </Link>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-xs font-mono", difficultyColor(a.problem_difficulty))}>
            {a.problem_difficulty} · {difficultyLabel(a.problem_difficulty)}
          </span>
          {a.due_at && (
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                overdue ? "text-destructive" : "text-muted-foreground",
              )}
            >
              <Clock className="h-3 w-3" />
              {formatDate(a.due_at)}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
          <Link href={`/probleme/${a.problem_slug}`}>
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </Button>
        {isTeacher && onRemove && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onRemove}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function ProgressTable({ progress }: { progress: HomeworkProgress }) {
  const { homework, members } = progress;
  const problems = homework.assignments;

  if (members.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Niciun student înscris.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left font-medium text-muted-foreground py-2 pr-3 min-w-[140px]">
              Student
            </th>
            {problems.map((p) => (
              <th
                key={p.id}
                className="text-center font-medium text-muted-foreground py-2 px-2 min-w-[80px] max-w-[100px]"
                title={p.problem_title}
              >
                <span className="truncate block">{p.problem_title}</span>
              </th>
            ))}
            <th className="text-center font-medium text-muted-foreground py-2 pl-2 min-w-[60px]">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {members.map((m) => {
            const solvedSet = new Set(m.solved_problem_ids);
            const solvedCount = problems.filter((p) => solvedSet.has(p.problem_id)).length;
            return (
              <tr key={m.student_id} className="border-b border-border/50 hover:bg-muted/20">
                <td className="py-2 pr-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Avatar className="h-5 w-5 shrink-0">
                      {m.student_avatar_url && (
                        <AvatarImage src={resolveMediaUrl(m.student_avatar_url)} />
                      )}
                      <AvatarFallback className="text-[8px]">
                        {m.student_username.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{m.student_display_name}</span>
                  </div>
                </td>
                {problems.map((p) => (
                  <td key={p.id} className="text-center py-2 px-2">
                    {solvedSet.has(p.problem_id) ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 mx-auto" />
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground/40 mx-auto" />
                    )}
                  </td>
                ))}
                <td className="text-center py-2 pl-2 font-medium">
                  <span
                    className={cn(
                      solvedCount === problems.length
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground",
                    )}
                  >
                    {solvedCount}/{problems.length}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function HomeworkCard({
  hw,
  classId,
  isTeacher,
  onDelete,
  onRemoveProblem,
  onAddProblem,
}: {
  hw: HomeworkRead;
  classId: string;
  isTeacher: boolean;
  onDelete: () => void;
  onRemoveProblem: (assignmentId: string) => void;
  onAddProblem: (slug: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [addingSlug, setAddingSlug] = useState("");
  const [addingOpen, setAddingOpen] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);

  const { data: progress, isLoading: progressLoading, refetch: refetchProgress } = useQuery({
    queryKey: ["homework-progress", classId, hw.id],
    queryFn: () =>
      api.get(`/api/classes/${classId}/homework/${hw.id}/progress`, HomeworkProgressSchema),
    enabled: showProgress && isTeacher,
    staleTime: 30_000,
  });

  const solved = hw.assignments.filter((a) => a.user_solved).length;
  const total = hw.assignments.length;
  const overdue = hw.due_at && new Date(hw.due_at) < new Date();

  async function handleAddProblem() {
    const slug = addingSlug.trim();
    if (!slug) return;
    setLoadingAdd(true);
    try {
      await onAddProblem(slug);
      setAddingSlug("");
      setAddingOpen(false);
    } finally {
      setLoadingAdd(false);
    }
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors select-none"
        onClick={() => setExpanded((e) => !e)}
      >
        <span className="text-muted-foreground shrink-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{hw.title}</p>
          <div className="flex items-center gap-3 mt-0.5">
            {hw.due_at && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs",
                  overdue ? "text-destructive" : "text-muted-foreground",
                )}
              >
                <Clock className="h-3 w-3" />
                {formatDate(hw.due_at)}
              </span>
            )}
            {!isTeacher && (
              <span
                className={cn(
                  "text-xs font-medium",
                  solved === total && total > 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground",
                )}
              >
                {solved}/{total} rezolvate
              </span>
            )}
            {isTeacher && (
              <span className="text-xs text-muted-foreground">{total} probleme</span>
            )}
          </div>
        </div>
        <div
          className="flex items-center gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {isTeacher && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                onClick={() => {
                  setShowProgress((s) => !s);
                  setExpanded(true);
                  if (!showProgress) refetchProgress();
                }}
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Progres
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-3 space-y-1 bg-muted/10">
          {hw.description_md && (
            <p className="text-xs text-muted-foreground mb-2">{hw.description_md}</p>
          )}

          {hw.assignments.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">Nicio problemă adăugată.</p>
          ) : (
            hw.assignments.map((a) => (
              <AssignmentRow
                key={a.id}
                a={a}
                isTeacher={isTeacher}
                onRemove={() => onRemoveProblem(a.id)}
              />
            ))
          )}

          {isTeacher && (
            <div className="pt-2">
              {!addingOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs text-muted-foreground"
                  onClick={() => setAddingOpen(true)}
                >
                  <Plus className="h-3 w-3" />
                  Adaugă problemă
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    className="h-7 text-xs"
                    placeholder="slug-problemă"
                    value={addingSlug}
                    onChange={(e) => setAddingSlug(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddProblem()}
                    autoFocus
                  />
                  <Button size="sm" className="h-7" onClick={handleAddProblem} disabled={loadingAdd}>
                    Adaugă
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => { setAddingOpen(false); setAddingSlug(""); }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {isTeacher && showProgress && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                Progres studenți
              </p>
              {progressLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                  ))}
                </div>
              ) : progress ? (
                <ProgressTable progress={progress} />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AssignmentsTab({ classId, isTeacher }: Props) {
  const queryClient = useQueryClient();
  const [composingHw, setComposingHw] = useState(false);
  const [hwForm, setHwForm] = useState({
    title: "",
    description_md: "",
    due_at: "",
    slugs: [""],
  });

  const { data: homeworks = [], isLoading } = useQuery({
    queryKey: ["homework", classId],
    queryFn: () => api.get(`/api/classes/${classId}/homework`, z.array(HomeworkReadSchema)),
    staleTime: 30_000,
  });

  function addSlugField() {
    setHwForm((f) => ({ ...f, slugs: [...f.slugs, ""] }));
  }

  function removeSlugField(i: number) {
    setHwForm((f) => ({ ...f, slugs: f.slugs.filter((_, idx) => idx !== i) }));
  }

  function setSlug(i: number, val: string) {
    setHwForm((f) => {
      const slugs = [...f.slugs];
      slugs[i] = val;
      return { ...f, slugs };
    });
  }

  async function handleCreateHw() {
    const slugs = hwForm.slugs.map((s) => s.trim()).filter(Boolean);
    if (!hwForm.title.trim() || slugs.length === 0) return;
    try {
      const hw = await api.post<HomeworkRead>(`/api/classes/${classId}/homework`, {
        title: hwForm.title.trim(),
        description_md: hwForm.description_md || null,
        due_at: hwForm.due_at || null,
        problem_slugs: slugs,
      });
      queryClient.setQueryData<HomeworkRead[]>(["homework", classId], (prev) =>
        prev ? [hw, ...prev] : [hw],
      );
      setHwForm({ title: "", description_md: "", due_at: "", slugs: [""] });
      setComposingHw(false);
      toast.success("Temă creată");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare");
    }
  }

  async function handleDeleteHw(hwId: string) {
    if (!confirm("Ștergi această temă și toate problemele din ea?")) return;
    try {
      await api.delete(`/api/classes/${classId}/homework/${hwId}`);
      queryClient.setQueryData<HomeworkRead[]>(["homework", classId], (prev) =>
        prev?.filter((h) => h.id !== hwId),
      );
      toast.success("Temă ștearsă");
    } catch {
      toast.error("Eroare");
    }
  }

  async function handleRemoveProblem(hwId: string, assignmentId: string) {
    try {
      await api.delete(`/api/classes/${classId}/assignments/${assignmentId}`);
      queryClient.setQueryData<HomeworkRead[]>(["homework", classId], (prev) =>
        prev?.map((h) =>
          h.id === hwId
            ? { ...h, assignments: h.assignments.filter((a) => a.id !== assignmentId) }
            : h,
        ),
      );
      toast.success("Problemă eliminată");
    } catch {
      toast.error("Eroare");
    }
  }

  async function handleAddProblem(hwId: string, slug: string) {
    const added = await api.post<AssignmentRead>(
      `/api/classes/${classId}/homework/${hwId}/problems`,
      { problem_slug: slug },
    );
    queryClient.setQueryData<HomeworkRead[]>(["homework", classId], (prev) =>
      prev?.map((h) =>
        h.id === hwId ? { ...h, assignments: [...h.assignments, added] } : h,
      ),
    );
    toast.success("Problemă adăugată");
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {isTeacher && !composingHw && (
        <Button size="sm" onClick={() => setComposingHw(true)} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Temă nouă
        </Button>
      )}

      {composingHw && (
        <div className="rounded-md border border-border p-4 space-y-3">
          <Input
            placeholder="Titlu temă (ex: Tema 1 - Recursivitate)"
            value={hwForm.title}
            onChange={(e) => setHwForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            className="w-full min-h-[60px] rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            placeholder="Descriere (opțional)"
            value={hwForm.description_md}
            onChange={(e) => setHwForm((f) => ({ ...f, description_md: e.target.value }))}
          />
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Termen limită (opțional)</label>
            <Input
              type="datetime-local"
              value={hwForm.due_at}
              onChange={(e) => setHwForm((f) => ({ ...f, due_at: e.target.value }))}
              className="w-52"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Probleme (slug-uri)</label>
            {hwForm.slugs.map((slug, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder={`slug-${i + 1} (ex: suma-a-doua-numere)`}
                  value={slug}
                  onChange={(e) => setSlug(i, e.target.value)}
                />
                {hwForm.slugs.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0"
                    onClick={() => removeSlugField(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button size="sm" variant="ghost" className="gap-1.5 text-xs" onClick={addSlugField}>
              <Plus className="h-3 w-3" />
              Adaugă problemă
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleCreateHw}>
              Creează temă
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setComposingHw(false);
                setHwForm({ title: "", description_md: "", due_at: "", slugs: [""] });
              }}
            >
              Anulează
            </Button>
          </div>
        </div>
      )}

      {homeworks.length === 0 && !composingHw && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {isTeacher ? "Nicio temă creată." : "Nicio temă atribuită."}
        </p>
      )}

      <div className="space-y-3">
        {homeworks.map((hw) => (
          <HomeworkCard
            key={hw.id}
            hw={hw}
            classId={classId}
            isTeacher={isTeacher}
            onDelete={() => handleDeleteHw(hw.id)}
            onRemoveProblem={(aid) => handleRemoveProblem(hw.id, aid)}
            onAddProblem={(slug) => handleAddProblem(hw.id, slug)}
          />
        ))}
      </div>
    </div>
  );
}
