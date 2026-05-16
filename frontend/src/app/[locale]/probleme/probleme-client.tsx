"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, X, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { DifficultyIndicator } from "@/components/problems/difficulty-indicator";
import { StatusIcon } from "@/components/problems/status-icon";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { ProblemListResponseSchema, ALL_TAGS, TAG_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { ProblemListItem } from "@/lib/types";

const PER_PAGE = 20;

const SORT_OPTIONS = [
  { value: "newest", label: "Cele mai noi" },
  { value: "easiest", label: "Cele mai ușoare" },
  { value: "hardest", label: "Cele mai grele" },
  { value: "most_solved", label: "Cele mai rezolvate" },
] as const;

const DIFF_ANY = "any";

const DIFFICULTY_OPTIONS = [
  { value: DIFF_ANY, label: "Orice" },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  })),
];

export default function ProblemeClient() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [, startTransition] = useTransition();

  const q = params.get("q") ?? "";
  const diffMin = params.get("diff_min") ?? "";
  const diffMax = params.get("diff_max") ?? "";
  const activeTags = params.getAll("tags");
  const status = params.get("status") ?? "";
  const sort = (params.get("sort") ?? "newest") as string;
  const page = Number(params.get("page") ?? "1");

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(params.toString());
      if (value === null || value === "") {
        next.delete(key);
      } else {
        next.set(key, value);
      }
      next.delete("page");
      startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const next = new URLSearchParams(params.toString());
      const current = next.getAll("tags");
      next.delete("tags");
      if (current.includes(tag)) {
        current.filter((t) => t !== tag).forEach((t) => next.append("tags", t));
      } else {
        [...current, tag].forEach((t) => next.append("tags", t));
      }
      next.delete("page");
      startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  const setPage = useCallback(
    (p: number) => {
      const next = new URLSearchParams(params.toString());
      next.set("page", String(p));
      startTransition(() => router.replace(`?${next.toString()}`, { scroll: false }));
    },
    [params, router],
  );

  const clearFilters = useCallback(() => {
    startTransition(() => router.replace("?", { scroll: false }));
  }, [router]);

  const buildQuery = () => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("per_page", String(PER_PAGE));
    if (q) p.set("search", q);
    if (diffMin) p.set("difficulty_min", diffMin);
    if (diffMax) p.set("difficulty_max", diffMax);
    activeTags.forEach((t) => p.append("tags", t));
    if (status && isAuthenticated) p.set("status", status);
    p.set("sort", sort);
    return p.toString();
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["problems", q, diffMin, diffMax, activeTags.join(","), status, sort, page],
    queryFn: () => api.get(`/api/problems/?${buildQuery()}`, ProblemListResponseSchema),
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  });

  const hasFilters = q || diffMin || diffMax || activeTags.length > 0 || status;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Probleme</h1>
          {data && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {data.total.toLocaleString("ro")} probleme
            </p>
          )}
        </div>
        {user?.role === "teacher" || user?.role === "admin" ? (
          <Button asChild size="sm" className="gap-1.5">
            <Link href="/probleme/nou">
              <Plus className="h-3.5 w-3.5" />
              Adaugă
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-5">
          <div>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Caută..."
                className="h-8 pl-8 text-sm"
                value={q}
                onChange={(e) => setParam("q", e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sortare
            </p>
            <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Dificultate
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Min</p>
                <Select
                  value={diffMin || DIFF_ANY}
                  onValueChange={(v) => setParam("diff_min", v === DIFF_ANY ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Max</p>
                <Select
                  value={diffMax || DIFF_ANY}
                  onValueChange={(v) => setParam("diff_max", v === DIFF_ANY ? "" : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {isAuthenticated && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Status
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(["", "solved", "attempted", "unsolved"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setParam("status", s)}
                    className={cn(
                      "rounded border px-2 py-1 text-xs transition-colors",
                      status === s
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                    )}
                  >
                    {s === "" ? "Toate" : s === "solved" ? "Rezolvat" : s === "attempted" ? "Încercat" : "Nerezolvat"}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Etichete
            </p>
            <div className="flex flex-wrap gap-1">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded border px-2 py-0.5 text-xs transition-colors",
                    activeTags.includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                  )}
                >
                  {TAG_LABELS[tag] ?? tag}
                </button>
              ))}
            </div>
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
              Șterge filtrele
            </button>
          )}
        </aside>

        <div className="min-w-0">
          <div className={cn("overflow-hidden rounded border border-border", isFetching && !isLoading && "opacity-70 transition-opacity")}>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {isAuthenticated && <TableHead className="w-8" />}
                  <TableHead className="w-12 font-mono text-xs">#</TableHead>
                  <TableHead>Titlu</TableHead>
                  <TableHead className="w-28 text-center">Dificultate</TableHead>
                  <TableHead className="hidden sm:table-cell">Etichete</TableHead>
                  <TableHead className="hidden w-24 text-right font-mono text-xs md:table-cell">
                    Rezolvate
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: PER_PAGE }).map((_, i) => (
                      <TableRow key={i}>
                        {isAuthenticated && (
                          <TableCell>
                            <Skeleton className="h-3.5 w-3.5 rounded-full" />
                          </TableCell>
                        )}
                        <TableCell>
                          <Skeleton className="h-3.5 w-8" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-3.5 w-48" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="mx-auto h-3 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Skeleton className="ml-auto h-3.5 w-10" />
                        </TableCell>
                      </TableRow>
                    ))
                  : data?.items.map((problem, idx) => (
                      <ProblemRow
                        key={problem.id}
                        problem={problem}
                        index={(page - 1) * PER_PAGE + idx + 1}
                        showStatus={isAuthenticated}
                        onTagClick={toggleTag}
                        activeTag={(tag) => activeTags.includes(tag)}
                      />
                    ))}

                {!isLoading && data?.items.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={isAuthenticated ? 6 : 5}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      Nu au fost găsite probleme.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {data && data.pages > 1 && (
            <div className="mt-4 flex items-center justify-between text-sm">
              <span className="text-xs text-muted-foreground">
                Pagina {page} din {data.pages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(page - 1)}
                  disabled={page <= 1}
                  aria-label="Pagina anterioară"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                {Array.from({ length: Math.min(data.pages, 7) }, (_, i) => {
                  const p = getPageNumber(i, page, data.pages);
                  return p === null ? (
                    <span key={i} className="px-1 text-muted-foreground">
                      …
                    </span>
                  ) : (
                    <Button
                      key={p}
                      variant={p === page ? "outline" : "ghost"}
                      size="sm"
                      className={cn(
                        "h-7 w-7 p-0 font-mono text-xs",
                        p === page && "border-primary text-primary",
                      )}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => setPage(page + 1)}
                  disabled={page >= data.pages}
                  aria-label="Pagina următoare"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ProblemRow({
  problem,
  index,
  showStatus,
  onTagClick,
  activeTag,
}: {
  problem: ProblemListItem;
  index: number;
  showStatus: boolean;
  onTagClick: (tag: string) => void;
  activeTag: (tag: string) => boolean;
}) {
  return (
    <TableRow>
      {showStatus && (
        <TableCell className="w-8 pr-0">
          <StatusIcon status={problem.user_status} />
        </TableCell>
      )}
      <TableCell className="font-mono text-xs text-muted-foreground">
        {String(index).padStart(4, "0")}
      </TableCell>
      <TableCell>
        <Link
          href={`/probleme/${problem.slug}`}
          className="font-medium transition-colors hover:text-primary"
        >
          {problem.title}
        </Link>
      </TableCell>
      <TableCell className="text-center">
        <DifficultyIndicator difficulty={problem.difficulty} className="mx-auto" />
      </TableCell>
      <TableCell className="hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {problem.tags.slice(0, 3).map((tag) => (
            <button
              key={tag}
              onClick={() => onTagClick(tag)}
              className={cn(
                "rounded border px-1.5 py-0.5 text-xs transition-colors",
                activeTag(tag)
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {TAG_LABELS[tag] ?? tag}
            </button>
          ))}
          {problem.tags.length > 3 && (
            <span className="text-xs text-muted-foreground">+{problem.tags.length - 3}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="hidden text-right font-mono text-xs text-muted-foreground md:table-cell">
        {problem.solve_count.toLocaleString("ro")}
      </TableCell>
    </TableRow>
  );
}

function getPageNumber(index: number, current: number, total: number): number | null {
  if (total <= 7) return index + 1;
  const pages = [1, current - 1, current, current + 1, total].filter(
    (p) => p >= 1 && p <= total,
  );
  const unique = [...new Set(pages)].sort((a, b) => a - b);
  const withEllipsis: (number | null)[] = [];
  for (let i = 0; i < unique.length; i++) {
    if (i > 0 && unique[i] - unique[i - 1] > 1) withEllipsis.push(null);
    withEllipsis.push(unique[i]);
  }
  return withEllipsis[index] ?? null;
}
