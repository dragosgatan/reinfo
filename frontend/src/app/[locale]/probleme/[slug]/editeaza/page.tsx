"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Trash2, Upload, X, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ProblemStatement } from "@/components/problems/problem-statement";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ProblemReadSchema, TestCaseListSchema, ALL_TAGS, TAG_LABELS } from "@/lib/types";
import type { TestCaseRead } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Titlul este obligatoriu").max(256),
  difficulty: z.coerce.number().int().min(1).max(10),
  statement_md: z.string().min(1, "Enunțul este obligatoriu"),
  statement_md_en: z.string().default(""),
  input_format: z.string().default(""),
  output_format: z.string().default(""),
  time_limit_ms: z.coerce.number().int().min(100).max(30000),
  memory_limit_kb: z.coerce.number().int().min(4096).max(524288),
  comparison_mode: z.enum(["exact", "whitespace_insensitive", "float_epsilon"]),
  float_epsilon: z.coerce.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(["draft", "public", "private", "contest"]),
});

type FormValues = z.infer<typeof schema>;

export default function EditProblemPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [statementLang, setStatementLang] = useState<"ro" | "en">("ro");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const watchStatement = watch("statement_md");
  const watchStatementEn = watch("statement_md_en");
  const watchTags = watch("tags");
  const watchComparisonMode = watch("comparison_mode");
  const watchVisibility = watch("visibility");

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== "teacher" && user.role !== "admin")) return;

    api.get(`/api/problems/${slug}`, ProblemReadSchema)
      .then((problem) => {
        reset({
          title: problem.title,
          difficulty: problem.difficulty,
          statement_md: problem.statement_md,
          statement_md_en: problem.statement_md_en ?? "",
          input_format: problem.input_format ?? "",
          output_format: problem.output_format ?? "",
          time_limit_ms: problem.time_limit_ms,
          memory_limit_kb: problem.memory_limit_kb,
          comparison_mode: problem.comparison_mode as FormValues["comparison_mode"],
          float_epsilon: problem.float_epsilon ?? null,
          tags: problem.tags,
          visibility: problem.visibility as FormValues["visibility"],
        });
        setLoaded(true);
      })
      .catch(() => setLoadError("Nu s-a putut încărca problema."));
  }, [authLoading, user, slug, reset]);

  const toggleTag = useCallback(
    (tag: string) => {
      const current = watchTags ?? [];
      setValue(
        "tags",
        current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      );
    },
    [watchTags, setValue],
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        await api.patch(
          `/api/problems/${slug}`,
          {
            title: values.title,
            statement_md: values.statement_md,
            statement_md_en: values.statement_md_en || null,
            input_format: values.input_format ?? "",
            output_format: values.output_format ?? "",
            difficulty: values.difficulty,
            tags: values.tags,
            visibility: values.visibility,
            time_limit_ms: values.time_limit_ms,
            memory_limit_kb: values.memory_limit_kb,
            comparison_mode: values.comparison_mode,
            float_epsilon:
              values.comparison_mode === "float_epsilon" ? values.float_epsilon : null,
          },
          ProblemReadSchema,
        );
        toast.success("Modificările au fost salvate.");
        router.push(`/probleme/${slug}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "A apărut o eroare.");
      } finally {
        setSubmitting(false);
      }
    },
    [slug, router],
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/problems/${slug}`);
      await queryClient.invalidateQueries({ queryKey: ["problems"] });
      toast.success("Problema a fost ștearsă.");
      router.push("/probleme");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "A apărut o eroare.");
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [slug, router]);

  if (authLoading) return null;

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">Acces interzis.</p>
        <Link href={`/probleme/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Înapoi la problemă
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Link href={`/probleme/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Înapoi la problemă
        </Link>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/probleme/${slug}`}
            className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Înapoi la problemă
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Editează problema</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={submitting}>
            {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            Salvează
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => router.push(`/probleme/${slug}`)}
            aria-label="Închide"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titlu</Label>
            <Input
              id="title"
              {...register("title")}
              className={cn(errors.title && "border-destructive")}
            />
            {errors.title && (
              <p className="text-xs text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label>Enunț</Label>
              <div className="flex rounded border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setStatementLang("ro")}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    statementLang === "ro"
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  RO
                </button>
                <button
                  type="button"
                  onClick={() => setStatementLang("en")}
                  className={cn(
                    "px-2.5 py-1 transition-colors",
                    statementLang === "en"
                      ? "bg-muted font-medium"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  EN
                </button>
              </div>
            </div>
            <Tabs defaultValue="edit">
              <TabsList className="mb-2">
                <TabsTrigger value="edit">
                  <EyeOff className="mr-1.5 h-3 w-3" />
                  Editare
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="mr-1.5 h-3 w-3" />
                  Previzualizare
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                {statementLang === "ro" ? (
                  <>
                    <textarea
                      {...register("statement_md")}
                      rows={10}
                      className={cn(
                        "w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                        errors.statement_md && "border-destructive",
                      )}
                    />
                    {errors.statement_md && (
                      <p className="mt-1 text-xs text-destructive">{errors.statement_md.message}</p>
                    )}
                  </>
                ) : (
                  <textarea
                    {...register("statement_md_en")}
                    rows={10}
                    placeholder="Problem statement in English (Markdown + LaTeX). Optional."
                    className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                )}
              </TabsContent>
              <TabsContent value="preview">
                {(statementLang === "ro" ? watchStatement : watchStatementEn) ? (
                  <div className="min-h-[200px] rounded border border-border p-4">
                    <ProblemStatement
                      markdown={(statementLang === "ro" ? watchStatement : watchStatementEn) ?? ""}
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center rounded border border-border text-sm text-muted-foreground">
                    Scrie enunțul pentru a vedea previzualizarea
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="input_format">Format date de intrare</Label>
              <textarea
                id="input_format"
                {...register("input_format")}
                rows={4}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="output_format">Format date de ieșire</Label>
              <textarea
                id="output_format"
                {...register("output_format")}
                rows={4}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label>Dificultate</Label>
            <Select
              value={String(watch("difficulty") ?? 3)}
              onValueChange={(v) => setValue("difficulty", Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {i + 1} —{" "}
                    {i < 3 ? "Ușor" : i < 6 ? "Mediu" : i < 8 ? "Greu" : "Foarte greu"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="time_limit_ms" className="text-xs">Timp (ms)</Label>
              <Input
                id="time_limit_ms"
                type="number"
                {...register("time_limit_ms")}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="memory_limit_kb" className="text-xs">Memorie (KB)</Label>
              <Input
                id="memory_limit_kb"
                type="number"
                {...register("memory_limit_kb")}
                className="h-8 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Mod comparare</Label>
            <Select
              value={watchComparisonMode ?? "exact"}
              onValueChange={(v) => setValue("comparison_mode", v as FormValues["comparison_mode"])}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">Exact</SelectItem>
                <SelectItem value="whitespace_insensitive">Ignoră spații</SelectItem>
                <SelectItem value="float_epsilon">Float epsilon</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {watchComparisonMode === "float_epsilon" && (
            <div className="space-y-1.5">
              <Label htmlFor="float_epsilon" className="text-xs">Epsilon</Label>
              <Input
                id="float_epsilon"
                type="number"
                step="any"
                placeholder="0.001"
                {...register("float_epsilon")}
                className="h-8 text-sm"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Vizibilitate</Label>
            {watchVisibility === "contest" ? (
              <div className="rounded border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                Gestionată de concurs
              </div>
            ) : (
              <Select
                value={watchVisibility ?? "draft"}
                onValueChange={(v) => setValue("visibility", v as FormValues["visibility"])}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Ciornă</SelectItem>
                  <SelectItem value="public">Publică</SelectItem>
                  <SelectItem value="private">Privată</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {user?.role === "admin" && (
            <>
              <Separator />
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-destructive/70">
                  Zonă periculoasă
                </p>
                <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                      Șterge problema
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Șterge problema</DialogTitle>
                      <DialogDescription>
                        Problema va fi ascunsă și nu va mai fi accesibilă utilizatorilor. Această acțiune poate fi anulată manual.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDeleteOpen(false)}
                        disabled={deleting}
                      >
                        Anulează
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleDelete}
                        disabled={deleting}
                      >
                        {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                        Confirmă ștergerea
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </>
          )}

          <Separator />

          <div>
            <Label className="mb-2 block">Etichete</Label>
            <div className="flex flex-wrap gap-1">
              {ALL_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={cn(
                    "rounded border px-2 py-0.5 text-xs transition-colors",
                    (watchTags ?? []).includes(tag)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-foreground/30",
                  )}
                >
                  {TAG_LABELS[tag] ?? tag}
                </button>
              ))}
            </div>
            {(watchTags ?? []).length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {watchTags!.map((tag) => (
                  <Badge key={tag} variant="default" className="text-xs">
                    {TAG_LABELS[tag] ?? tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </form>

    <TestCaseManager slug={slug} />
    </>
  );
}

function TestCaseManager({ slug }: { slug: string }) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [deletingOrdinal, setDeletingOrdinal] = useState<number | null>(null);
  const [mode, setMode] = useState<"text" | "file">("text");
  const inRef = useRef<HTMLInputElement>(null);
  const outRef = useRef<HTMLInputElement>(null);
  const [inText, setInText] = useState("");
  const [outText, setOutText] = useState("");
  const [ordinal, setOrdinal] = useState("");
  const [score, setScore] = useState("10");
  const [isSample, setIsSample] = useState(false);

  const { data: testCases, isLoading } = useQuery({
    queryKey: ["test-cases", slug],
    queryFn: () => api.get(`/api/problems/${slug}/test-cases`, TestCaseListSchema),
    staleTime: 0,
  });

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ["test-cases", slug] }),
    [queryClient, slug],
  );

  const handleDelete = useCallback(
    async (tc: TestCaseRead) => {
      setDeletingOrdinal(tc.ordinal);
      try {
        await api.delete(`/api/problems/${slug}/test-cases/${tc.ordinal}`);
        await invalidate();
        toast.success(`Cazul de test #${tc.ordinal} a fost șters.`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "A apărut o eroare.");
      } finally {
        setDeletingOrdinal(null);
      }
    },
    [slug, invalidate],
  );

  const submitFormData = useCallback(
    async (fd: FormData) => {
      const r = await fetch(`/api/problems/${slug}/test-cases`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!r.ok) {
        const payload = await r.json().catch(() => ({}));
        throw new ApiError(r.status, (payload as { detail?: string }).detail ?? r.statusText);
      }
    },
    [slug],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (ordinal === "") {
        toast.error("Introdu ordinalul cazului de test.");
        return;
      }

      let inBlob: Blob;
      let outBlob: Blob;

      if (mode === "text") {
        if (!inText.trim() && !outText.trim()) {
          toast.error("Completează cel puțin datele de intrare.");
          return;
        }
        inBlob = new Blob([inText], { type: "text/plain" });
        outBlob = new Blob([outText], { type: "text/plain" });
      } else {
        const inFile = inRef.current?.files?.[0];
        const outFile = outRef.current?.files?.[0];
        if (!inFile || !outFile) {
          toast.error("Selectează ambele fișiere (.in și .out).");
          return;
        }
        inBlob = inFile;
        outBlob = outFile;
      }

      setUploading(true);
      try {
        const fd = new FormData();
        fd.append("ordinal", ordinal);
        fd.append("score", score);
        fd.append("is_sample", String(isSample));
        fd.append("is_hidden", String(!isSample));
        fd.append("input_file", inBlob, `${ordinal}.in`);
        fd.append("output_file", outBlob, `${ordinal}.out`);
        await submitFormData(fd);
        await invalidate();
        toast.success(`Cazul de test #${ordinal} a fost adăugat.`);
        setOrdinal("");
        setScore("10");
        setIsSample(false);
        setInText("");
        setOutText("");
        if (inRef.current) inRef.current.value = "";
        if (outRef.current) outRef.current.value = "";
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "A apărut o eroare.");
      } finally {
        setUploading(false);
      }
    },
    [slug, mode, inText, outText, ordinal, score, isSample, invalidate, submitFormData],
  );

  return (
    <div className="mx-auto max-w-4xl px-4 pb-10 sm:px-6">
      <Separator className="my-8" />
      <h2 className="mb-4 text-base font-semibold tracking-tight">Cazuri de test</h2>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Se încarcă...</p>
      ) : testCases && testCases.length > 0 ? (
        <div className="mb-6 overflow-hidden rounded border border-border">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Scor</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tip</th>
                <th className="w-8 px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {testCases.map((tc) => (
                <tr key={tc.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-mono">{tc.ordinal}</td>
                  <td className="px-3 py-2 font-mono">{tc.score}p</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {tc.is_sample ? "exemplu" : "ascuns"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => handleDelete(tc)}
                      disabled={deletingOrdinal === tc.ordinal}
                      className="flex items-center text-muted-foreground transition-colors hover:text-destructive disabled:opacity-40"
                      aria-label={`Șterge cazul de test ${tc.ordinal}`}
                    >
                      {deletingOrdinal === tc.ordinal ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <X className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-6 text-xs text-muted-foreground">Niciun caz de test adăugat.</p>
      )}

      <form onSubmit={handleSubmit} className="rounded border border-border p-4">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Adaugă caz de test
          </p>
          <div className="flex rounded border border-border text-xs">
            <button
              type="button"
              onClick={() => setMode("text")}
              className={cn("px-2.5 py-1 transition-colors", mode === "text" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setMode("file")}
              className={cn("px-2.5 py-1 transition-colors", mode === "file" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Fișier
            </button>
          </div>
        </div>

        {mode === "text" ? (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Date de intrare (.in)</Label>
              <textarea
                value={inText}
                onChange={(e) => setInText(e.target.value)}
                rows={5}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="1 2 3"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Date de ieșire (.out)</Label>
              <textarea
                value={outText}
                onChange={(e) => setOutText(e.target.value)}
                rows={5}
                className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="6"
              />
            </div>
          </div>
        ) : (
          <div className="mb-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Fișier .in</Label>
              <input ref={inRef} type="file" accept=".in,text/*" className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fișier .out</Label>
              <input ref={outRef} type="file" accept=".out,text/*" className="block w-full text-xs text-muted-foreground file:mr-2 file:rounded file:border file:border-border file:bg-muted file:px-2 file:py-1 file:text-xs file:text-foreground" />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="tc-ordinal" className="text-xs">Ordinal</Label>
            <Input id="tc-ordinal" type="number" min={0} value={ordinal} onChange={(e) => setOrdinal(e.target.value)} className="h-8 w-24 text-sm" placeholder="0" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tc-score" className="text-xs">Scor</Label>
            <Input id="tc-score" type="number" min={0} value={score} onChange={(e) => setScore(e.target.value)} className="h-8 w-20 text-sm" />
          </div>
          <label className="flex items-center gap-1.5 pb-1 text-xs text-muted-foreground">
            <input type="checkbox" checked={isSample} onChange={(e) => setIsSample(e.target.checked)} className="h-3 w-3" />
            Exemplu
          </label>
          <Button type="submit" size="sm" disabled={uploading} className="h-8">
            {uploading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1.5 h-3.5 w-3.5" />}
            Adaugă
          </Button>
        </div>
      </form>
    </div>
  );
}
