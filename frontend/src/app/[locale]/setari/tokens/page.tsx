"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { KeyRound, Terminal, Trash2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ApiTokenReadSchema } from "@/lib/types";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export default function ApiTokensPage() {
  const t = useTranslations("settings.tokens");
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const { data: tokens, isLoading: tokensLoading } = useQuery({
    queryKey: ["api-tokens"],
    queryFn: () => api.get("/api/auth/tokens", z.array(ApiTokenReadSchema)),
    enabled: !!user,
  });

  if (isLoading) return null;

  if (!user) {
    router.push("/login");
    return null;
  }

  async function handleRevoke(id: string) {
    setRevokingId(id);
    try {
      await api.delete(`/api/auth/tokens/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["api-tokens"] });
      toast.success(t("revokeSuccess"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
    } finally {
      setRevokingId(null);
    }
  }

  const active = (tokens ?? []).filter((tok) => !tok.revoked_at);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="mb-2 flex items-center gap-2">
        <Terminal className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-bold tracking-tight">{t("title")}</h1>
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t("subtitle")}</p>

      <div className="mb-6 rounded border border-border bg-muted/20 p-4">
        <p className="mb-2 text-sm font-medium">{t("howToTitle")}</p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>{t("howToStep1")}</li>
          <li>
            {t("howToStep2Prefix")}{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">reinfo login</code>
          </li>
          <li>{t("howToStep3")}</li>
        </ol>
      </div>

      {tokensLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : active.length === 0 ? (
        <p className="rounded border border-border p-4 text-center text-sm text-muted-foreground">
          {t("noTokens")}
        </p>
      ) : (
        <div className="space-y-2">
          {active.map((tok) => (
            <div
              key={tok.id}
              className="flex items-center justify-between gap-3 rounded border border-border p-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{tok.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("created")}: {formatDate(tok.created_at)}
                    {tok.last_used_at
                      ? ` · ${t("lastUsed")}: ${new Date(tok.last_used_at).toLocaleString("ro")}`
                      : ` · ${t("neverUsed")}`}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                onClick={() => handleRevoke(tok.id)}
                disabled={revokingId === tok.id}
                aria-label={t("revoke")}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        <Link href="/setari/profil" className="hover:text-foreground hover:underline">
          {t("backToProfile")}
        </Link>
      </p>
    </div>
  );
}
