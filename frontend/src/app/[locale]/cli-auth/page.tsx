"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Terminal, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { useRouter, Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { DeviceInfoResponseSchema } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type CodeState = "checking" | "valid" | "invalid";
type ActionState = "idle" | "working" | "approved" | "denied";

export default function CliAuthPage() {
  const t = useTranslations("cliAuth");
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [code, setCode] = useState(searchParams.get("code")?.toUpperCase() ?? "");
  const [codeState, setCodeState] = useState<CodeState>("checking");
  const [action, setAction] = useState<ActionState>("idle");

  useEffect(() => {
    if (!code.trim()) {
      setCodeState("invalid");
      return;
    }
    let cancelled = false;
    setCodeState("checking");
    api
      .get(`/api/auth/device/info?code=${encodeURIComponent(code.trim())}`, DeviceInfoResponseSchema)
      .then((res) => {
        if (!cancelled) setCodeState(res.valid ? "valid" : "invalid");
      })
      .catch(() => {
        if (!cancelled) setCodeState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (isLoading) return null;

  if (!user) {
    const returnTo = encodeURIComponent(`/cli-auth?code=${code}`);
    router.push(`/login?next=${returnTo}` as Parameters<typeof router.push>[0]);
    return null;
  }

  async function respond(approve: boolean) {
    setAction("working");
    try {
      await api.post(`/api/auth/device/${approve ? "approve" : "deny"}`, {
        user_code: code.trim(),
      });
      setAction(approve ? "approved" : "denied");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("errorGeneric"));
      setAction("idle");
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Terminal className="h-5 w-5 text-muted-foreground" />
        <h1 className="text-lg font-bold tracking-tight">{t("title")}</h1>
      </div>

      {action === "approved" ? (
        <div className="rounded border border-success/30 bg-success/5 p-5 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success" />
          <p className="text-sm font-medium">{t("approvedTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("approvedBody")}</p>
        </div>
      ) : action === "denied" ? (
        <div className="rounded border border-border bg-muted/20 p-5 text-center">
          <XCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">{t("deniedTitle")}</p>
        </div>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">{t("subtitle")}</p>

          <div className="mb-5 space-y-1.5">
            <Label htmlFor="code">{t("codeLabel")}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="text-center font-mono text-lg tracking-widest"
              maxLength={9}
            />
          </div>

          {codeState === "invalid" && code.trim() && (
            <p className="mb-4 text-sm text-destructive">{t("invalidCode")}</p>
          )}

          <div className="flex gap-2">
            <Button
              onClick={() => respond(true)}
              disabled={codeState !== "valid" || action === "working"}
              className="flex-1 gap-2"
            >
              {action === "working" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("approveAction")}
            </Button>
            <Button
              variant="outline"
              onClick={() => respond(false)}
              disabled={codeState !== "valid" || action === "working"}
            >
              {t("denyAction")}
            </Button>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            {t("notYouPrefix")}{" "}
            <Link href="/setari/tokens" className="hover:text-foreground hover:underline">
              {t("manageTokensLink")}
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
