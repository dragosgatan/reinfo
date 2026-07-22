"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Eye, EyeOff, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { MarkdownContent } from "@/components/shared/markdown-content";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { CTF_CATEGORIES, CtfChallengeDetailSchema } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

const schema = z.object({
  title: z.string().min(1, "Title is required").max(256),
  statement_md: z.string().min(1, "Statement is required"),
  category: z.enum(CTF_CATEGORIES),
  difficulty: z.coerce.number().int().min(1).max(10),
  base_points: z.coerce.number().int().min(1),
  scoring: z.enum(["static", "dynamic"]),
  flag: z.string().max(256).optional(),
  flag_case_sensitive: z.boolean(),
  published: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export default function EditCtfChallengePage() {
  const t = useTranslations("ctf");
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const watchStatement = watch("statement_md");
  const watchPublished = watch("published");

  useEffect(() => {
    if (authLoading) return;
    if (!user || (user.role !== "teacher" && user.role !== "admin" && user.role !== "superuser")) {
      return;
    }

    api
      .get(`/api/ctf/${slug}`, CtfChallengeDetailSchema)
      .then((challenge) => {
        reset({
          title: challenge.title,
          statement_md: challenge.statement_md,
          category: challenge.category,
          difficulty: challenge.difficulty,
          base_points: challenge.base_points,
          scoring: challenge.scoring,
          flag: "",
          flag_case_sensitive: challenge.flag_case_sensitive,
          published: challenge.published,
        });
        setLoaded(true);
      })
      .catch(() => setLoadError(t("loadError")));
  }, [authLoading, user, slug, reset, t]);

  const onSubmit = useCallback(
    async (values: FormValues) => {
      setSubmitting(true);
      try {
        await api.patch(`/api/ctf/${slug}`, {
          title: values.title,
          statement_md: values.statement_md,
          category: values.category,
          difficulty: values.difficulty,
          base_points: values.base_points,
          scoring: values.scoring,
          flag: values.flag ? values.flag : null,
          flag_case_sensitive: values.flag_case_sensitive,
          published: values.published,
        });
        setValue("flag", "");
        toast.success(t("changesSaved"));
        router.push(`/ctf/${slug}`);
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      } finally {
        setSubmitting(false);
      }
    },
    [slug, router, t, setValue],
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/ctf/${slug}`);
      toast.success(t("challengeDeleted"));
      router.push("/probleme?tab=ctf");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      setDeleteOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [slug, router, t]);

  if (authLoading) return null;

  if (!user || (user.role !== "teacher" && user.role !== "admin" && user.role !== "superuser")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{t("permissionDenied")}</p>
        <Link href={`/ctf/${slug}`} className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToChallengeLink")}
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">{loadError}</p>
        <Link href="/probleme?tab=ctf" className="mt-4 inline-block text-sm text-primary hover:underline">
          {t("backToCtf")}
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
              href={`/ctf/${slug}`}
              className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              {t("backToChallengeLink")}
            </Link>
            <h1 className="text-xl font-bold tracking-tight">{t("editChallengeTitle")}</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{slug}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={submitting}>
              {submitting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("saveChanges")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              onClick={() => router.push(`/ctf/${slug}`)}
              aria-label={t("closeLabel")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">{t("titleLabel")}</Label>
              <Input
                id="title"
                {...register("title")}
                className={cn(errors.title && "border-destructive")}
              />
              {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
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
                    className={cn(
                      "w-full rounded border border-input bg-background px-3 py-2 font-mono text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring",
                      errors.statement_md && "border-destructive",
                    )}
                  />
                </TabsContent>
                <TabsContent value="preview">
                  <div className="min-h-[200px] rounded border border-border p-4">
                    <MarkdownContent markdown={watchStatement ?? ""} />
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            <Separator />

            <div className="space-y-1.5">
              <Label htmlFor="flag">{t("flagLabel")}</Label>
              <Input
                id="flag"
                {...register("flag")}
                placeholder={t("flagRotatePlaceholder")}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">{t("flagRotateHint")}</p>
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                {...register("flag_case_sensitive")}
                className="h-3.5 w-3.5 rounded border-border"
              />
              {t("flagCaseSensitiveLabel")}
            </label>

            <Separator />

            <HintManager slug={slug} />
            <AttachmentManager slug={slug} />
          </div>

          <aside className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("categoryLabel")}</Label>
              <Select
                value={watch("category")}
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
                      {i + 1}/10
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("scoringLabel")}</Label>
              <Select
                value={watch("scoring")}
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

            <div className="space-y-1.5">
              <Label>{t("publishedLabel")}</Label>
              <Select
                value={watchPublished ? "published" : "draft"}
                onValueChange={(v) => setValue("published", v === "published")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">{t("statusDraft")}</SelectItem>
                  <SelectItem value="published">{t("statusPublished")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t("deleteChallenge")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>{t("deleteChallenge")}</DialogTitle>
                  <DialogDescription>{t("deleteConfirmation")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)}>
                    {t("cancel")}
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                    {t("deleteChallenge")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </aside>
        </div>
      </form>
    </>
  );
}

function HintManager({ slug }: { slug: string }) {
  const t = useTranslations("ctf");
  const queryClient = useQueryClient();
  const { data: challenge } = useQuery({
    queryKey: ["ctf-challenge", slug],
    queryFn: () => api.get(`/api/ctf/${slug}`, CtfChallengeDetailSchema),
  });
  const [content, setContent] = useState("");
  const [cost, setCost] = useState("0");
  const [adding, setAdding] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ctf-challenge", slug] });

  const handleAdd = async () => {
    if (!content.trim()) return;
    setAdding(true);
    try {
      await api.post(`/api/ctf/${slug}/hints`, {
        content_md: content,
        cost: Number(cost) || 0,
        ordinal: challenge?.hints.length ?? 0,
      });
      setContent("");
      setCost("0");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (hintId: string) => {
    try {
      await api.delete(`/api/ctf/${slug}/hints/${hintId}`);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    }
  };

  return (
    <div>
      <Label className="mb-2 block">{t("hints")}</Label>
      <div className="mb-3 space-y-2">
        {challenge?.hints.map((hint, i) => (
          <div key={hint.id} className="flex items-start justify-between gap-2 rounded border border-border p-2.5">
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 text-xs text-muted-foreground">
                {t("hintNumber", { n: i + 1 })} · {hint.cost} {t("points")}
              </p>
              <p className="truncate text-sm">{hint.content_md}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(hint.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex items-start gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={2}
          placeholder={t("newHintPlaceholder")}
          className="flex-1 rounded border border-input bg-background px-2 py-1.5 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <Input
          type="number"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          className="h-9 w-20"
          aria-label={t("hintCostLabel")}
        />
        <Button type="button" size="sm" onClick={handleAdd} disabled={adding || !content.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function AttachmentManager({ slug }: { slug: string }) {
  const t = useTranslations("ctf");
  const queryClient = useQueryClient();
  const { data: challenge } = useQuery({
    queryKey: ["ctf-challenge", slug],
    queryFn: () => api.get(`/api/ctf/${slug}`, CtfChallengeDetailSchema),
  });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["ctf-challenge", slug] });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/ctf/${slug}/attachments`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error((payload as { detail?: string }).detail ?? t("errorGeneric"));
      }
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("errorGeneric"));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleRemove = async (attachmentId: string) => {
    try {
      await api.delete(`/api/ctf/${slug}/attachments/${attachmentId}`);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    }
  };

  return (
    <div>
      <Label className="mb-2 block">{t("attachments")}</Label>
      <div className="mb-3 flex flex-wrap gap-2">
        {challenge?.attachments.map((att) => (
          <div
            key={att.id}
            className="flex items-center gap-1.5 rounded border border-border px-2.5 py-1.5 font-mono text-xs"
          >
            {att.filename}
            <button
              type="button"
              onClick={() => handleRemove(att.id)}
              className="text-muted-foreground hover:text-destructive"
              aria-label={t("removeFile")}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="mr-1.5 h-3.5 w-3.5" />
        )}
        {t("uploadAttachment")}
      </Button>
    </div>
  );
}
