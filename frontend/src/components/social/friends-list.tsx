"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserMinus } from "lucide-react";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { FriendshipReadSchema } from "@/lib/types";
import { resolveMediaUrl } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function FriendsList() {
  const queryClient = useQueryClient();

  const { data: friends = [], isLoading } = useQuery({
    queryKey: ["social", "friends"],
    queryFn: () => api.get("/api/social/friends", z.array(FriendshipReadSchema)),
    staleTime: 30_000,
  });

  async function removeFriend(username: string) {
    try {
      await api.delete(`/api/social/friends/${username}`);
      queryClient.invalidateQueries({ queryKey: ["social", "friends"] });
      queryClient.invalidateQueries({ queryKey: ["social", "friend-status", username] });
      toast.success("Prieten eliminat");
    } catch {
      toast.error("Eroare la eliminarea prietenului");
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nu ai prieteni adăugați încă.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {friends.map((f) => (
        <li
          key={f.id}
          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted transition-colors"
        >
          <Link href={`/u/${f.friend_username}`} className="flex items-center gap-3 flex-1 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="h-8 w-8">
                {f.friend_avatar_url && (
                  <AvatarImage
                    src={resolveMediaUrl(f.friend_avatar_url)}
                    alt={f.friend_username}
                  />
                )}
                <AvatarFallback className="text-xs">
                  {f.friend_username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                  f.online ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{f.friend_display_name}</p>
              <p className="text-xs text-muted-foreground truncate">@{f.friend_username}</p>
            </div>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
            onClick={() => removeFriend(f.friend_username)}
            title="Elimină prieten"
          >
            <UserMinus className="h-3.5 w-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );
}
