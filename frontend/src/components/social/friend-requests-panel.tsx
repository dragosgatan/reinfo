"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, X } from "lucide-react";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { FriendRequestReadSchema } from "@/lib/types";
import { resolveMediaUrl, formatDate } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";

export function FriendRequestsPanel() {
  const t = useTranslations("friends");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["social", "friend-requests"],
    queryFn: () => api.get("/api/social/friends/requests", z.array(FriendRequestReadSchema)),
    staleTime: 30_000,
  });

  async function accept(id: string, senderUsername: string) {
    try {
      await api.post(`/api/social/friends/request/${id}/accept`, {});
      queryClient.invalidateQueries({ queryKey: ["social", "friend-requests"] });
      queryClient.invalidateQueries({ queryKey: ["social", "friends"] });
      queryClient.invalidateQueries({ queryKey: ["social", "friend-status", senderUsername] });
      toast.success(t("requestAccepted"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function reject(id: string) {
    try {
      await api.post(`/api/social/friends/request/${id}/reject`, {});
      queryClient.invalidateQueries({ queryKey: ["social", "friend-requests"] });
      toast.success(t("requestDeclined"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  if (isLoading) {
    return <div className="h-10 rounded-md bg-muted animate-pulse" />;
  }

  if (requests.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t("noFriendRequests")}
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {requests.map((req) => (
        <li key={req.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
          <Link href={`/u/${req.sender_username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
            <Avatar className="h-8 w-8 shrink-0">
              {req.sender_avatar_url && (
                <AvatarImage
                  src={resolveMediaUrl(req.sender_avatar_url)}
                  alt={req.sender_username}
                />
              )}
              <AvatarFallback className="text-xs">
                {req.sender_username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{req.sender_display_name}</p>
              <p className="text-xs text-muted-foreground">{formatDate(req.created_at)}</p>
            </div>
          </Link>
          <div className="flex gap-1.5 shrink-0">
            <Button
              size="icon"
              className="h-7 w-7"
              onClick={() => accept(req.id, req.sender_username)}
              title={t("acceptRequest")}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={() => reject(req.id)}
              title={t("declineRequest")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}