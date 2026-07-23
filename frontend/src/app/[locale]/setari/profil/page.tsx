"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/navigation";
import { useAuth, type User } from "@/lib/auth";
import { api } from "@/lib/api";
import { cn, resolveMediaUrl } from "@/lib/utils";
import { routing } from "@/i18n/routing";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ExternalLink, Github, Link as LinkIcon } from "lucide-react";
import { MarkdownContent } from "@/components/shared/markdown-content";

function Toggle({
  checked,
  onChange,
  id,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  id: string;
}) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-background shadow-md ring-0 transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function ProfileSettingsPage() {
  const t = useTranslations("settings.profile");
  const tCommon = useTranslations("common");
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    display_name: "",
    bio: "",
    language: "ro",
    privacy_show_email: false,
    privacy_show_activity: true,
    privacy_show_solved: true,
    github_url: "",
    link_1: "",
    link_2: "",
    link_3: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [bioTab, setBioTab] = useState<"write" | "preview">("write");

  useEffect(() => {
    if (user) {
      setForm({
        display_name: user.display_name ?? user.username,
        bio: user.bio ?? "",
        language: user.language ?? "ro",
        privacy_show_email: user.privacy_show_email ?? false,
        privacy_show_activity: user.privacy_show_activity ?? true,
        privacy_show_solved: user.privacy_show_solved ?? true,
        github_url: user.github_url ?? "",
        link_1: user.link_1 ?? "",
        link_2: user.link_2 ?? "",
        link_3: user.link_3 ?? "",
      });
    }
  }, [user]);

  if (isLoading) {
    return <div className="mx-auto max-w-xl px-4 py-16 text-center text-muted-foreground">{t("saving")}...</div>;
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  const u = user as User;
  const initials = u.username.slice(0, 2).toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.patch<User>("/api/users/me", {
        display_name: form.display_name,
        bio: form.bio || null,
        language: form.language,
        privacy_show_email: form.privacy_show_email,
        privacy_show_activity: form.privacy_show_activity,
        privacy_show_solved: form.privacy_show_solved,
        github_url: form.github_url || null,
        link_1: form.link_1 || null,
        link_2: form.link_2 || null,
        link_3: form.link_3 || null,
      });
      queryClient.setQueryData(["auth", "me"], updated);
      toast.success(t("saveSuccess"));

      const newLocale = routing.locales.find((l) => l === form.language);
      if (newLocale && newLocale !== locale) {
        router.replace(pathname, { locale: newLocale });
      }
    } catch {
      toast.error(t("saveError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/users/me/avatar", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("upload failed");
      const updated = (await res.json()) as User;
      queryClient.setQueryData(["auth", "me"], updated);
      toast.success(t("avatarSuccess"));
    } catch {
      toast.error(t("avatarError"));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-bold tracking-tight">{t("title")}</h1>
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link href={`/u/${u.username}`}>
            <ExternalLink className="h-3.5 w-3.5" />
            {t("viewProfile")}
          </Link>
        </Button>
      </div>

      <form onSubmit={handleSave} className="space-y-8">
        <section className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              {t("avatar")}
            </p>
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20 rounded-lg">
                  {u.avatar_url && (
                    <AvatarImage src={resolveMediaUrl(u.avatar_url)} alt={u.username} className="rounded-lg" />
                  )}
                  <AvatarFallback className="rounded-lg font-mono text-xl">{initials}</AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background shadow-sm hover:bg-muted transition-colors"
                >
                  <Camera className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="text-xs"
                >
                  {uploadingAvatar ? tCommon("loading") : t("changeAvatar")}
                </Button>
                <p className="mt-1 text-[11px] text-muted-foreground">{t("avatarHint")}</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="display_name" className="text-sm">
              {t("displayName")}
            </Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              maxLength={128}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="bio" className="text-sm">
                {t("bio")}
              </Label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setBioTab("write")}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    bioTab === "write"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("bioWriteTab")}
                </button>
                <button
                  type="button"
                  onClick={() => setBioTab("preview")}
                  className={cn(
                    "rounded px-2 py-0.5 text-xs font-medium transition-colors",
                    bioTab === "preview"
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("bioPreviewTab")}
                </button>
              </div>
            </div>
            {bioTab === "write" ? (
              <textarea
                id="bio"
                value={form.bio}
                onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                placeholder={t("bioPlaceholder")}
                maxLength={2000}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              />
            ) : (
              <div className="min-h-[104px] rounded-md border border-input bg-muted/20 px-3 py-2">
                {form.bio.trim() ? (
                  <MarkdownContent markdown={form.bio} allowImages={false} />
                ) : (
                  <p className="text-sm text-muted-foreground">{t("bioPlaceholder")}</p>
                )}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground text-right">{form.bio.length}/2000</p>
          </div>

          <div className="space-y-1">
            <Label htmlFor="language" className="text-sm">
              {t("language")}
            </Label>
            <select
              id="language"
              value={form.language}
              onChange={(e) => setForm((f) => ({ ...f, language: e.target.value }))}
              className="flex h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="ro">Română</option>
              <option value="en">English</option>
              <option value="hu">Magyar</option>
            </select>
          </div>
        </section>

        <section className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("links")}
          </p>
          <div className="space-y-1">
            <Label htmlFor="github_url" className="text-sm flex items-center gap-1.5">
              <Github className="h-3.5 w-3.5" />
              {t("githubUrl")}
            </Label>
            <Input
              id="github_url"
              type="url"
              value={form.github_url}
              onChange={(e) => setForm((f) => ({ ...f, github_url: e.target.value }))}
              placeholder={t("githubUrlPlaceholder")}
              maxLength={256}
              className="max-w-sm"
            />
          </div>
          {(["link_1", "link_2", "link_3"] as const).map((key, i) => (
            <div key={key} className="space-y-1">
              <Label htmlFor={key} className="text-sm flex items-center gap-1.5">
                <LinkIcon className="h-3.5 w-3.5" />
                {t(`link${i + 1}` as "link1" | "link2" | "link3")}
              </Label>
              <Input
                id={key}
                type="url"
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={t("linkPlaceholder")}
                maxLength={256}
                className="max-w-sm"
              />
            </div>
          ))}
        </section>

        <section className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("privacy")}
          </p>
          {[
            {
              id: "privacy_show_email",
              key: "privacy_show_email" as const,
              label: t("showEmail"),
            },
            {
              id: "privacy_show_activity",
              key: "privacy_show_activity" as const,
              label: t("showActivity"),
            },
            {
              id: "privacy_show_solved",
              key: "privacy_show_solved" as const,
              label: t("showSolved"),
            },
          ].map(({ id, key, label }) => (
            <div key={id} className="flex items-center justify-between gap-4 py-1">
              <Label htmlFor={id} className="text-sm font-normal cursor-pointer">
                {label}
              </Label>
              <Toggle
                id={id}
                checked={form[key]}
                onChange={(v) => setForm((f) => ({ ...f, [key]: v }))}
              />
            </div>
          ))}
        </section>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <Button type="submit" disabled={saving} size="sm">
            {saving ? t("saving") : t("save")}
          </Button>
          {(u.role === "admin" || u.role === "superuser") && (
            <Badge variant="secondary" className="text-xs">
              Admin
            </Badge>
          )}
        </div>
      </form>
    </div>
  );
}
