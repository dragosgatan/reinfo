"use client";

import { useTranslations } from "next-intl";
import { LogOut, Settings, Shield, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useRouter } from "@/i18n/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function UserMenu() {
  const t = useTranslations("auth");
  const { user, isLoading, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();

  async function handleLogout() {
    try {
      await api.post("/api/auth/logout", {});
      queryClient.setQueryData(["auth", "me"], null);
      router.push("/");
    } catch {
      toast.error(t("logout"));
    }
  }

  if (isLoading) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-muted" aria-hidden="true" />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-1.5">
        <Button asChild variant="ghost" size="sm">
          <Link href="/login">{t("login")}</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/register">{t("register")}</Link>
        </Button>
      </div>
    );
  }

  const initials = user.username.slice(0, 2).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="relative h-8 w-8 rounded-full p-0"
          aria-label={t("userMenu")}
        >
          <Avatar className="h-8 w-8">
            {user.avatar_url && (
              <AvatarImage src={resolveMediaUrl(user.avatar_url)} alt={user.username} />
            )}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">{user.username}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/u/${user.username}`}>
            <User className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("profile")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/setari/profil">
            <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        {(user.role === "admin" || user.role === "superuser") && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin">
                <Shield className="mr-2 h-4 w-4" aria-hidden="true" />
                Admin
              </Link>
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
