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

/** dispatched by the duel lobby right after a successful queue join, so this
 * watcher drops its idle cadence and starts polling fast immediately instead
 * of waiting for its next already-scheduled idle check */
export const DUEL_QUEUE_JOINED_EVENT = "duel-queue-joined";

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
      if (timerRef.current) clearTimeout(timerRef.current);

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

    const onQueueJoined = () => {
      inQueueRef.current = true;
      check();
    };
    window.addEventListener(DUEL_QUEUE_JOINED_EVENT, onQueueJoined);

    check();
    return () => {
      window.removeEventListener(DUEL_QUEUE_JOINED_EVENT, onQueueJoined);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [user, router, locale, t]);

  return null;
}