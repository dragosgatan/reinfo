"use client";

import { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Swords } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useNotificationsWs } from "@/lib/use-notifications";
import { NotificationReadSchema, DuelRequestReadSchema, type NotificationRead, type DuelRequestRead } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { z } from "zod";
import { Link } from "@/i18n/navigation";

function DuelRequestItem({
  req,
  onAccept,
  onDecline,
}: {
  req: DuelRequestRead;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="px-3 py-2.5 hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <Swords className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-sm">
          <span className="font-medium">{req.from_username}</span> te provoacă la duel
        </p>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {req.time_limit_minutes} min · dif. {req.difficulty_min}–{req.difficulty_max}
      </p>
      <div className="flex gap-1.5">
        <Button size="sm" className="h-6 text-xs" onClick={onAccept}>
          Acceptă
        </Button>
        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={onDecline}>
          Refuză
        </Button>
      </div>
    </div>
  );
}

function SocialNotificationItem({
  notif,
  onRead,
}: {
  notif: NotificationRead;
  onRead: () => void;
}) {
  let payload: Record<string, string> = {};
  try {
    payload = JSON.parse(notif.payload);
  } catch {
    /* ignore */
  }

  const label =
    notif.type === "friend_request"
      ? `${payload.from_display_name ?? payload.from_username} ți-a trimis o cerere de prietenie`
      : `${payload.from_display_name ?? payload.from_username} ți-a acceptat cererea de prietenie`;

  const href =
    notif.type === "friend_request" || notif.type === "friend_accepted"
      ? `/u/${payload.from_username}`
      : "#";

  return (
    <Link
      href={href}
      onClick={onRead}
      className={cn(
        "flex items-start gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted",
        !notif.read && "bg-muted/60",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn("leading-snug truncate", !notif.read && "font-medium")}>{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(notif.created_at)}</p>
      </div>
      {!notif.read && (
        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </Link>
  );
}

export function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [duelRequests, setDuelRequests] = useState<DuelRequestRead[]>([]);

  useNotificationsWs();

  const { data: notifications = [] } = useQuery({
    queryKey: ["social", "notifications"],
    queryFn: () => api.get("/api/social/notifications", z.array(NotificationReadSchema)),
    enabled: isAuthenticated,
    staleTime: 60_000,
  });

  const pollDuels = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await api.get("/api/duels/requests/pending", z.array(DuelRequestReadSchema));
      setDuelRequests(data);
    } catch {
      /* ignore */
    }
  }, [isAuthenticated]);

  useEffect(() => {
    pollDuels();
    const interval = setInterval(pollDuels, 15_000);
    return () => clearInterval(interval);
  }, [pollDuels]);

  async function handleAcceptDuel(requestId: string) {
    try {
      const duel = await api.post<{ id: string }>(`/api/duels/requests/${requestId}/accept`, {});
      toast.success("Duel început!");
      setDuelRequests((prev) => prev.filter((r) => r.id !== requestId));
      setOpen(false);
      router.push(`/duel/${duel.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare");
    }
  }

  async function handleDeclineDuel(requestId: string) {
    try {
      await api.post(`/api/duels/requests/${requestId}/decline`, {});
      setDuelRequests((prev) => prev.filter((r) => r.id !== requestId));
      toast.success("Provocare refuzată.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Eroare");
    }
  }

  async function markAllRead() {
    await api.patch("/api/social/notifications/read-all", {});
    queryClient.setQueryData<NotificationRead[]>(
      ["social", "notifications"],
      (prev) => prev?.map((n) => ({ ...n, read: true })) ?? [],
    );
  }

  async function markOneRead(id: string) {
    await api.patch(`/api/social/notifications/${id}/read`, {}).catch(() => {});
    queryClient.setQueryData<NotificationRead[]>(
      ["social", "notifications"],
      (prev) => prev?.map((n) => (n.id === id ? { ...n, read: true } : n)) ?? [],
    );
  }

  if (!isAuthenticated) return null;

  const unreadSocial = notifications.filter((n) => !n.read).length;
  const totalUnread = unreadSocial + duelRequests.length;
  const hasItems = duelRequests.length > 0 || notifications.length > 0;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-8 w-8">
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
              {totalUnread > 9 ? "9+" : totalUnread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Notificări</span>
          {unreadSocial > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Marchează toate citite
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!hasItems ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              Nicio notificare
            </p>
          ) : (
            <>
              {duelRequests.length > 0 && (
                <div>
                  {duelRequests.length > 0 && notifications.length > 0 && (
                    <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Dueluri
                    </p>
                  )}
                  <div className="divide-y divide-border">
                    {duelRequests.map((req) => (
                      <DuelRequestItem
                        key={req.id}
                        req={req}
                        onAccept={() => handleAcceptDuel(req.id)}
                        onDecline={() => handleDeclineDuel(req.id)}
                      />
                    ))}
                  </div>
                </div>
              )}
              {notifications.length > 0 && (
                <div>
                  {duelRequests.length > 0 && (
                    <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Activitate
                    </p>
                  )}
                  {notifications.map((n) => (
                    <SocialNotificationItem
                      key={n.id}
                      notif={n}
                      onRead={() => {
                        if (!n.read) markOneRead(n.id);
                        setOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
