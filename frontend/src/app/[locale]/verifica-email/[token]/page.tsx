"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api, ApiError } from "@/lib/api";

type Status = "verifying" | "success" | "error";

export default function VerifyEmailPage() {
  const t = useTranslations("verifyEmail");
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [status, setStatus] = useState<Status>("verifying");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        await api.post("/api/auth/verify-email", { token });
        if (!cancelled) setStatus("success");
      } catch (err) {
        if (cancelled) return;
        setErrorMessage(
          err instanceof ApiError && err.status === 400 ? t("errorInvalidToken") : t("errorGeneric"),
        );
        setStatus("error");
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="mb-6">
          <p className="mb-3 font-mono text-xs text-muted-foreground">{"// confirmare email"}</p>
          <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
        </div>

        {status === "verifying" && (
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>{t("subtitle")}</p>
          </div>
        )}

        {status === "success" && <p className="text-sm text-muted-foreground">{t("success")}</p>}

        {status === "error" && <p className="text-sm text-destructive">{errorMessage}</p>}

        {status !== "verifying" && (
          <p className="mt-6 text-sm text-muted-foreground">
            <Link
              href="/login"
              className="font-medium text-foreground transition-colors hover:text-primary"
            >
              {t("backToLogin")}
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
