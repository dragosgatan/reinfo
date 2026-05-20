"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { UserPlus, UserCheck, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { FriendStatusSchema } from "@/lib/types";
import { toast } from "sonner";

interface Props {
  username: string;
}

export function AddFriendButton({ username }: Props) {
  const t = useTranslations("friends");
  const tCommon = useTranslations("common");
  const { user, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ["social", "friend-status", username],
    queryFn: () => api.get(`/api/social/friends/status/${username}`, FriendStatusSchema),
    enabled: isAuthenticated && user?.username !== username,
    staleTime: 30_000,
  });

  if (!isAuthenticated || user?.username === username || isLoading || !status) return null;

  async function handleClick() {
    if (!status) return;

    try {
      if (status.is_friend) {
        await api.delete(`/api/social/friends/${username}`);
        queryClient.setQueryData(["social", "friend-status", username], {
          ...status,
          is_friend: false,
          pending_sent: false,
          pending_received: false,
          request_id: null,
        });
        queryClient.invalidateQueries({ queryKey: ["social", "friends"] });
        toast.success(t("friendRemoved"));
        return;
      }

      if (status.pending_sent) {
        toast.info(t("requestAlreadySent"));
        return;
      }

      if (status.pending_received && status.request_id) {
        await api.post(`/api/social/friends/request/${status.request_id}/accept`, {});
        queryClient.setQueryData(["social", "friend-status", username], {
          ...status,
          is_friend: true,
          pending_received: false,
          request_id: null,
        });
        queryClient.invalidateQueries({ queryKey: ["social", "friends"] });
        toast.success(t("requestAccepted"));
        return;
      }

      const result = await api.post(`/api/social/friends/request/${username}`, {});
      queryClient.setQueryData(["social", "friend-status", username], {
        ...status,
        pending_sent: true,
        request_id: (result as { id: string }).id ?? null,
      });
      toast.success(t("requestSent"));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tCommon("error");
      toast.error(msg);
    }
  }

  if (status.is_friend) {
    return (
      <Button variant="outline" size="sm" onClick={handleClick}>
        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
        {t("friendStatusFriend")}
      </Button>
    );
  }

  if (status.pending_sent) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Clock className="mr-1.5 h-3.5 w-3.5" />
        {t("friendStatusPending")}
      </Button>
    );
  }

  if (status.pending_received) {
    return (
      <Button size="sm" onClick={handleClick}>
        <UserCheck className="mr-1.5 h-3.5 w-3.5" />
        {t("friendStatusAccept")}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick}>
      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
      {t("friendStatusAdd")}
    </Button>
  );
}