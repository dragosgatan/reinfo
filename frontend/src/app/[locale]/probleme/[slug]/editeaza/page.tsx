"use client";

import { useState, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
import { ProblemStatement } from "@/components/problems/problem-statement";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ProblemReadSchema, ALL_TAGS, TAG_LABELS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Titlul este obligatoriu").max(256),
  difficulty: z.coerce.number().int().min(1).max(10),
  statement_md: z.string().min(1, "Enunțul este obligatoriu"),
  input_format: z.string().default(""),
  output_format: z.string().default(""),
  time_limit_ms: z.coerce.number().int().min(100).max(30000),
  memory_limit_kb: z.coerce.number().int().min(4096).max(524288),
  comparison_mode: z.enum(["exact", "whitespace_insensitive", "float_epsilon"]),
  float_epsilon: z.coerce.number().optional().nullable(),
  tags: z.array(z.string()).default([]),
  visibility: z.enum(["draft", "public", "private"]),
});

type FormValues = z.infer<typeof schema>;

export default function EditProblemPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

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
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href={`/probleme/${slug}`}
            className="mb-1 inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
          >
            ← Înapoi la problemă
          </Link>
          <h1 className="text-xl font-bold tracking-tight">Editează problema</h1>
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{slug}</p>
        </div>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
          Salvează
        </Button>
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
            <Label className="mb-2 block">Enunț</Label>
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
              </TabsContent>
              <TabsContent value="preview">
                {watchStatement ? (
                  <div className="min-h-[200px] rounded border border-border p-4">
                    <ProblemStatement markdown={watchStatement} />
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
          </div>

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
  );
}
