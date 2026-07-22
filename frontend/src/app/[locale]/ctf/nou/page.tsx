"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { CTF_CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(256),
  slug: z
    .string()
    .min(1, "Slug is required")
    .max(128)
    .regex(/^[a-z0-9-]+$/, "Only lowercase letters, digits and hyphens"),
  statement_md: z.string().min(1, "Statement is required"),
  category: z.enum(CTF_CATEGORIES).default("misc"),
  difficulty: z.coerce.number().int().min(1).max(10),
  base_points: z.coerce.number().int().min(1),
  scoring: z.enum(["static", "dynamic"]).default("static"),
  flag: z.string().min(1, "Flag is required").max(256),
  flag_case_sensitive: z.boolean().default(true),
});

type FormValues = z.infer<typeof schema>;

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 128);
}

export default function NouCtfChallengePage() {
  const t = useTranslations("ctf");
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [publishMode, setPublishMode] = useState<"draft" | "public">("draft");

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      difficulty: 3,
      base_points: 100,
      category: "misc",
      scoring: "static",
      flag_case_sensitive: true,
    },
  });

  const watchTitle = watch("title");
  const watchSlug = watch("slug");
  const watchStatement = watch("statement_md");

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const title = e.target.value;
      setValue("title", title);
      if (!watchSlug || watchSlug === slugify(watchTitle ?? "")) {
        setValue("slug", slugify(title));
      }
    },
    [setValue, watchSlug, watchTitle],
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        const challenge = await api.post("/api/ctf", {
          slug: values.slug,
          title: values.title,
          statement_md: values.statement_md,
          category: values.category,
          difficulty: values.difficulty,
          base_points: values.base_points,
          scoring: values.scoring,
          flag: values.flag,
          flag_case_sensitive: values.flag_case_sensitive,
          published: publishMode === "public",
        });
        toast.success(publishMode === "public" ? t("challengePublished") : t("draftSaved"));
        router.push(`/ctf/${(challenge as { slug: string }).slug}`);
      } catch (err) {
        const msg =
          err instanceof ApiError && err.status === 409
            ? t("slugConflict")
            : err instanceof Error
              ? err.message
              : t("errorGeneric");
        toast.error(msg);
      } finally {
        setSubmitting(false);
      }
    },
    [publishMode, router, t],
  );

  if (isLoading) return null;

  if (!user || (user.role !== "teacher" && user.role !== "admin" && user.role !== "superuser")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{t("permissionDenied")}</p>
        <Link href="/probleme?tab=ctf" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToCtf")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">{t("newChallenge")}</h1>
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={submitting}
            onClick={() => setPublishMode("draft")}
          >
            {submitting && publishMode === "draft" && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {t("saveDraft")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={submitting}
            onClick={() => setPublishMode("public")}
          >
            {submitting && publishMode === "public" && (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            )}
            {t("publish")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/probleme?tab=ctf")}
            aria-label={t("closeLabel")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input
                id="title"
                {...register("title")}
                onChange={handleTitleChange}
                placeholder="Warmup"
                className={cn(errors.title && "border-destructive")}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="slug">
                {t("slugLabel")}{" "}
                <span className="text-xs font-normal text-muted-foreground">{t("slugAuto")}</span>
              </Label>
              <Input
                id="slug"
                {...register("slug")}
                placeholder="warmup"
                className={cn("font-mono", errors.slug && "border-destructive")}
              />
              {errors.slug && <p className="text-xs text-destructive">{errors.slug.message}</p>}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">{t("statement")}</Label>
            <Tabs defaultValue="edit">
              <TabsList className="mb-2">
                <TabsTrigger value="edit">
                  <EyeOff className="mr-1.5 h-3 w-3" />
                  {t("editTab")}
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="mr-1.5 h-3 w-3" />
                  {t("previewTab")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <textarea
                  {...register("statement_md")}
                  rows={10}
                  placeholder={t("statementPlaceholder")}
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
                    <MarkdownContent markdown={watchStatement} />
                  </div>
                ) : (
                  <div className="flex min-h-[200px] items-center justify-center rounded border border-border text-sm text-muted-foreground">
                    {t("previewPlaceholder")}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label htmlFor="flag">{t("flagLabel")}</Label>
            <Input
              id="flag"
              {...register("flag")}
              placeholder="reinfo{...}"
              className={cn("font-mono", errors.flag && "border-destructive")}
            />
            {errors.flag && <p className="text-xs text-destructive">{errors.flag.message}</p>}
            <p className="text-xs text-muted-foreground">{t("flagHint")}</p>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              defaultChecked
              {...register("flag_case_sensitive")}
              className="h-3.5 w-3.5 rounded border-border"
            />
            {t("flagCaseSensitiveLabel")}
          </label>
        </div>

        <aside className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t("categoryLabel")}</Label>
            <Select
              defaultValue="misc"
              onValueChange={(v) => setValue("category", v as FormValues["category"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CTF_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {t(`category.${cat}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("difficultyLabel")}</Label>
            <Select defaultValue="3" onValueChange={(v) => setValue("difficulty", Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 10 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {i + 1}/10
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t("scoringLabel")}</Label>
            <Select
              defaultValue="static"
              onValueChange={(v) => setValue("scoring", v as FormValues["scoring"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="static">{t("scoringStatic")}</SelectItem>
                <SelectItem value="dynamic">{t("scoringDynamic")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="base_points">{t("basePointsLabel")}</Label>
            <Input id="base_points" type="number" {...register("base_points")} className="h-9" />
          </div>
        </aside>
      </div>
    </form>
  );
}
