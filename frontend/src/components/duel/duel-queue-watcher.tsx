"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { QueueEntryReadSchema } from "@/lib/types";

const POLL_MS = 3000;

export function DuelQueueWatcher() {
  const { user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("friends");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const redirectedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      try {
        const raw = await api.get("/api/duels/queue/status");
        const parsed = QueueEntryReadSchema.safeParse(raw);
        if (!parsed.success) return;

        const entry = parsed.data;
        if (
          entry.status === "matched" &&
          entry.matched_duel_id &&
          entry.matched_duel_id !== redirectedRef.current
        ) {
          redirectedRef.current = entry.matched_duel_id;
          toast.success(t("duelStarted"), { duration: 4000 });
          router.push(`/${locale}/duel/${entry.matched_duel_id}`);
        }
      } catch {
        // Silently ignore — user may not be in queue, or network hiccup
      }
    };

    timerRef.current = setInterval(check, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [user, router, locale, t]);

  return null;
}