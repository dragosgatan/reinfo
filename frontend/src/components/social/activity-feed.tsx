"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { ActivityFeedItemSchema } from "@/lib/types";
import { resolveMediaUrl, formatDate } from "@/lib/utils";
import { Link } from "@/i18n/navigation";

export function ActivityFeed() {
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["social", "activity"],
    queryFn: () => api.get("/api/social/activity", z.array(ActivityFeedItemSchema)),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Nicio activitate recentă de la prieteni.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.submission_id} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-muted transition-colors">
          <Link href={`/u/${item.username}`} className="shrink-0 mt-0.5">
            <Avatar className="h-8 w-8">
              {item.avatar_url && (
                <AvatarImage src={resolveMediaUrl(item.avatar_url)} alt={item.username} />
              )}
              <AvatarFallback className="text-xs">
                {item.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-sm leading-snug">
              <Link href={`/u/${item.username}`} className="font-medium hover:underline">
                {item.display_name}
              </Link>{" "}
              a rezolvat{" "}
              <Link
                href={`/probleme/${item.problem_slug}`}
                className="font-medium hover:underline text-foreground"
              >
                {item.problem_title}
              </Link>
            </p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge variant="outline" className="text-emerald-600 border-emerald-200 dark:border-emerald-800 dark:text-emerald-400 text-[10px] px-1.5 py-0">
                AC
              </Badge>
              <span className="text-xs text-muted-foreground">{item.score}p</span>
              <span className="text-xs text-muted-foreground">{item.language}</span>
              <span className="text-xs text-muted-foreground">{formatDate(item.created_at)}</span>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
