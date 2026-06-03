"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { QueueEntryReadSchema } from "@/lib/types";

const POLL_ACTIVE_MS = 3000;
const POLL_IDLE_MS = 30000;

export function DuelQueueWatcher() {
  const { user } = useAuth();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("friends");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const redirectedRef = useRef<string | null>(null);
  const inQueueRef = useRef(false);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      try {
        const raw = await api.get("/api/duels/queue/status");
        const parsed = QueueEntryReadSchema.safeParse(raw);

        if (parsed.success) {
          const entry = parsed.data;
          inQueueRef.current = entry.status === "waiting";

          if (
            entry.status === "matched" &&
            entry.matched_duel_id &&
            entry.matched_duel_id !== redirectedRef.current
          ) {
            redirectedRef.current = entry.matched_duel_id;
            inQueueRef.current = false;
            toast.success(t("duelStarted"), { duration: 4000 });
            router.push(`/${locale}/duel/${entry.matched_duel_id}`);
            return;
          }
        } else {
          inQueueRef.current = false;
        }
      } catch {
        inQueueRef.current = false;
      }

      timerRef.current = setTimeout(
        check,
        inQueueRef.current ? POLL_ACTIVE_MS : POLL_IDLE_MS,
      );
    };

    check();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, router, locale, t]);

  return null;
}