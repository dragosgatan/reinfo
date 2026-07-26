"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, ExternalLink, Monitor, Palette, Terminal } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { useRouter } from "@/i18n/navigation";
import { useAuth, type User } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { useFluidMode } from "@/lib/use-fluid-mode";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  {
    id: "system",
    labelKey: "system",
    swatch: { bg: "hsl(0 0% 60%)", primary: "hsl(0 0% 20%)" },
  },
  {
    id: "light",
    labelKey: "light",
    swatch: { bg: "hsl(0 0% 98%)", primary: "hsl(0 0% 11%)" },
  },
  {
    id: "dark",
    labelKey: "dark",
    swatch: { bg: "hsl(0 0% 9%)", primary: "hsl(0 0% 97%)" },
  },
  {
    id: "ocean",
    labelKey: "ocean",
    swatch: { bg: "hsl(0 0% 98%)", primary: "hsl(217 91% 35%)" },
  },
  {
    id: "teal",
    labelKey: "teal",
    swatch: { bg: "hsl(0 0% 98%)", primary: "hsl(175 70% 25%)" },
  },
  {
    id: "high-contrast",
    labelKey: "highContrast",
    swatch: { bg: "hsl(0 0% 0%)", primary: "hsl(60 100% 50%)" },
  },
] as const;

export default function AppearanceSettingsPage() {
  const t = useTranslations("settings.appearance");
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useTheme();
  const { fluid, setFluid } = useFluidMode();
  const [saving, setSaving] = useState<string | null>(null);
  const syncedFromServer = useRef(false);

  useEffect(() => {
    if (!syncedFromServer.current && user) {
      syncedFromServer.current = true;
      if (user.theme && user.theme !== theme) {
        setTheme(user.theme);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (isLoading) return null;

  if (!user) {
    router.push("/login");
    return null;
  }

  const u = user as User;

  async function handleSelect(id: string) {
    setTheme(id);
    setSaving(id);
    try {
      const updated = await api.patch<User>("/api/users/me", {
        theme: id === "system" ? null : id,
      });
      queryClient.setQueryData(["auth", "me"], updated);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-bold tracking-tight">{t("title")}</h1>
        </div>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link href="/setari/tokens">
              <Terminal className="h-3.5 w-3.5" />
              CLI
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
            <Link href={`/u/${u.username}`}>
              <ExternalLink className="h-3.5 w-3.5" />
              {t("viewProfile")}
            </Link>
          </Button>
        </div>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const selected = (theme ?? "system") === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleSelect(opt.id)}
              disabled={saving !== null}
              aria-pressed={selected}
              className={cn(
                "group relative flex flex-col items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                selected
                  ? "border-foreground/40 bg-foreground/5"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <div
                className="flex h-12 w-full items-center justify-center rounded-md border border-black/5"
                style={{ backgroundColor: opt.swatch.bg }}
              >
                {opt.id === "system" ? (
                  <Monitor className="h-4 w-4" style={{ color: opt.swatch.primary }} />
                ) : (
                  <span
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: opt.swatch.primary }}
                  />
                )}
              </div>
              <span className="text-xs font-medium">{t(`options.${opt.labelKey}`)}</span>
              {selected && (
                <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-background">
                  <Check className="h-2.5 w-2.5" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex items-center justify-between gap-4 border-t border-border pt-6">
        <div>
          <p className="text-sm font-medium">{t("fluidMode")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("fluidModeDesc")}</p>
        </div>
        <ToggleSwitch id="fluid-mode" checked={fluid} onChange={setFluid} />
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        <Link href="/setari/profil" className="hover:text-foreground hover:underline">
          {t("backToProfile")}
        </Link>
      </p>
    </div>
  );
}
