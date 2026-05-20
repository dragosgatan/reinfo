"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { api } from "@/lib/api";
import { DuelRequestReadSchema, type DuelRequestRead } from "@/lib/types";
import { z } from "zod";
import { useAuth } from "@/lib/auth";

export function PendingDuelRequests() {
  const t = useTranslations("friends");
  const tDuel = useTranslations("duel");
  const tCommon = useTranslations("common");
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [requests, setRequests] = useState<DuelRequestRead[]>([]);

  const poll = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.get(
        "/api/duels/requests/pending",
        z.array(DuelRequestReadSchema),
      );
      setRequests(data);
    } catch {
      // silently ignore polling errors
    }
  }, [isAuthenticated]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 15_000);
    return () => clearInterval(interval);
  }, [poll]);

  const handleAccept = async (requestId: string) => {
    try {
      const duel = await api.post<{ id: string }>(
        `/api/duels/requests/${requestId}/accept`,
        {},
      );
      toast.success(t("duelStarted"));
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      router.push(`/duel/${duel.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await api.post(`/api/duels/requests/${requestId}/decline`, {});
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success(t("challengeDeclined"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : tCommon("error"));
    }
  };

  if (!isAuthenticated || requests.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="relative h-8 w-8 p-0"
        >
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
            {requests.length}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="border-b border-border px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("pendingChallenges")}
          </p>
        </div>
        <div className="divide-y divide-border">
          {requests.map((req) => (
            <div key={req.id} className="px-3 py-2.5">
              <p className="text-sm">
                <span className="font-mono font-semibold">{req.from_username}</span>{" "}
                {t("challengesYou")}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {req.time_limit_minutes} min · dif. {req.difficulty_min}–{req.difficulty_max}
              </p>
              <div className="mt-2 flex gap-1.5">
                <Button
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() => handleAccept(req.id)}
                >
                  {tDuel("accept")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 text-xs"
                  onClick={() => handleDecline(req.id)}
                >
                  {tDuel("decline")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}