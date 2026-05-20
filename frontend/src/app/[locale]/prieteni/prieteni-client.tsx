"use client";

import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { FriendsList } from "@/components/social/friends-list";
import { FriendRequestsPanel } from "@/components/social/friend-requests-panel";
import { ActivityFeed } from "@/components/social/activity-feed";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function FriendsPageClient() {
  const { isAuthenticated, isLoading } = useAuth();
  const t = useTranslations("friends");

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" aria-hidden="true" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-muted-foreground">
          {t("loginRequired")}{" "}
          <Link href="/login" className="underline hover:text-foreground">
            {t("loginAction")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t("title")}</h1>

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">{t("tabActivity")}</TabsTrigger>
          <TabsTrigger value="friends">{t("tabFriends")}</TabsTrigger>
          <TabsTrigger value="requests">{t("tabRequests")}</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="mt-6">
          <ActivityFeed />
        </TabsContent>

        <TabsContent value="friends" className="mt-6">
          <FriendsList />
        </TabsContent>

        <TabsContent value="requests" className="mt-6">
          <FriendRequestsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
