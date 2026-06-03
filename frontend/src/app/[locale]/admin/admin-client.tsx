"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { resolveMediaUrl } from "@/lib/utils";

const AdminUserSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  email: z.string(),
  display_name: z.string(),
  avatar_url: z.string().nullable(),
  role: z.enum(["student", "teacher", "admin", "superuser"]),
  is_banned: z.boolean(),
  created_at: z.string(),
  last_active_at: z.string(),
});

const AdminUserListSchema = z.object({
  total: z.number(),
  users: z.array(AdminUserSchema),
});

const AdminStatsSchema = z.object({
  total_users: z.number(),
  total_problems: z.number(),
  total_submissions: z.number(),
  total_contests: z.number(),
  users_by_role: z.record(z.number()),
});

type AdminUser = z.infer<typeof AdminUserSchema>;
type AdminStats = z.infer<typeof AdminStatsSchema>;

const ROLE_COLORS: Record<string, string> = {
  student: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  teacher: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-400",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-400",
  superuser: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border bg-card px-5 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">
        {value.toLocaleString("ro-RO")}
      </p>
    </div>
  );
}

function UserRowSkeleton() {
  return (
    <div className="grid grid-cols-[1fr_180px_100px_90px_80px] items-center gap-3 border-b border-border px-4 py-3">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-6 w-20 rounded" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-7 w-16 rounded" />
    </div>
  );
}

function UserRow({
  user,
  currentUserId,
  currentUserIsSuperuser,
  onRoleChange,
  onBanToggle,
  isPending,
  roleLabels,
  bannedBadge,
  superuserProtected,
  actionBan,
  actionUnban,
}: {
  user: AdminUser;
  currentUserId: string;
  currentUserIsSuperuser: boolean;
  onRoleChange: (userId: string, role: string) => void;
  onBanToggle: (userId: string, ban: boolean) => void;
  isPending: boolean;
  roleLabels: Record<string, string>;
  bannedBadge: string;
  superuserProtected: string;
  actionBan: string;
  actionUnban: string;
}) {
  const isSelf = user.id === currentUserId;
  const isTargetSuperuser = user.role === "superuser";
  const isTargetAdmin = user.role === "admin";
  const initials = user.username.slice(0, 2).toUpperCase();

  const canEditRole = !isSelf && !isTargetSuperuser && (currentUserIsSuperuser || !isTargetAdmin);
  const canBan = !isSelf && !isTargetSuperuser && (currentUserIsSuperuser || !isTargetAdmin);

  return (
    <div
      className={`grid grid-cols-[1fr_200px_110px_90px_80px] items-center gap-3 border-b border-border px-4 py-2.5 transition-colors hover:bg-muted/20 ${
        user.is_banned ? "opacity-60" : ""
      }`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <Avatar className="h-6 w-6 shrink-0 rounded">
          {user.avatar_url && (
            <AvatarImage
              src={resolveMediaUrl(user.avatar_url)}
              alt={user.username}
              className="rounded"
            />
          )}
          <AvatarFallback className="rounded text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <span className="block truncate text-sm font-medium">{user.username}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{user.email}</span>
        </div>
        {user.is_banned && (
          <Badge className="ml-1 border-0 bg-red-100 px-1.5 py-0 text-[9px] text-red-600 dark:bg-red-900/30 dark:text-red-400">
            {bannedBadge}
          </Badge>
        )}
        {isTargetSuperuser && (
          <Badge className="ml-1 border-0 bg-amber-100 px-1.5 py-0 text-[9px] text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            {superuserProtected}
          </Badge>
        )}
      </div>

      <span className="truncate text-xs text-muted-foreground">{user.display_name}</span>

      <div>
        {canEditRole ? (
          <Select
            value={user.role}
            onValueChange={(val) => onRoleChange(user.id, val)}
            disabled={isPending}
          >
            <SelectTrigger className="h-7 w-[100px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="student">{roleLabels.student}</SelectItem>
              <SelectItem value="teacher">{roleLabels.teacher}</SelectItem>
              {currentUserIsSuperuser && (
                <SelectItem value="admin">{roleLabels.admin}</SelectItem>
              )}
            </SelectContent>
          </Select>
        ) : (
          <span
            className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-semibold ${ROLE_COLORS[user.role] ?? ""}`}
          >
            {roleLabels[user.role] ?? user.role}
          </span>
        )}
      </div>

      <span className="font-mono text-[11px] text-muted-foreground">
        {formatDate(user.created_at)}
      </span>

      <div>
        {canBan && (
          <Button
            size="sm"
            variant={user.is_banned ? "outline" : "destructive"}
            className="h-7 px-2.5 text-xs"
            disabled={isPending}
            onClick={() => onBanToggle(user.id, !user.is_banned)}
          >
            {user.is_banned ? actionUnban : actionBan}
          </Button>
        )}
      </div>
    </div>
  );
}

export function AdminClient() {
  const t = useTranslations("admin");
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const debouncedSearch = useDebounced(search, 300);
  const isPrivileged = user?.role === "admin" || user?.role === "superuser";
  const isSuperuser = user?.role === "superuser";

  useEffect(() => {
    if (!authLoading && !isPrivileged) {
      router.replace("/");
    }
  }, [authLoading, isPrivileged, router]);

  const statsQuery = useQuery({
    queryKey: ["admin", "stats"],
    queryFn: () => api.get("/api/admin/stats", AdminStatsSchema),
    enabled: isPrivileged,
  });

  const usersQuery = useQuery({
    queryKey: ["admin", "users", debouncedSearch, roleFilter, page],
    queryFn: () =>
      api.get(
        `/api/admin/users?search=${encodeURIComponent(debouncedSearch)}&role=${roleFilter === "all" ? "" : roleFilter}&page=${page}&limit=25`,
        AdminUserListSchema,
      ),
    enabled: isPrivileged,
  });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/api/admin/users/${userId}/role`, { role }),
    onMutate: ({ userId }) => setPendingUserId(userId),
    onSettled: () => {
      setPendingUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "stats"] });
    },
  });

  const banMutation = useMutation({
    mutationFn: ({ userId, is_banned }: { userId: string; is_banned: boolean }) =>
      api.patch(`/api/admin/users/${userId}/ban`, { is_banned }),
    onMutate: ({ userId }) => setPendingUserId(userId),
    onSettled: () => {
      setPendingUserId(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });

  const roleLabels: Record<string, string> = {
    student: t("roleStudent"),
    teacher: t("roleTeacher"),
    admin: t("roleAdmin"),
    superuser: t("roleSuperuser"),
  };

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="mb-6 grid grid-cols-4 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!isPrivileged) return null;

  const stats: AdminStats | undefined = statsQuery.data;
  const totalPages = usersQuery.data ? Math.ceil(usersQuery.data.total / 25) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats ? (
          <>
            <StatCard label={t("statUsers")} value={stats.total_users} />
            <StatCard label={t("statProblems")} value={stats.total_problems} />
            <StatCard label={t("statSubmissions")} value={stats.total_submissions} />
            <StatCard label={t("statContests")} value={stats.total_contests} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded" />)
        )}
      </div>

      {stats && (
        <div className="mb-6 flex flex-wrap gap-2">
          {Object.entries(stats.users_by_role).map(([role, count]) => (
            <span
              key={role}
              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[role] ?? ""}`}
            >
              {roleLabels[role] ?? role}
              <span className="font-mono font-bold">{count}</span>
            </span>
          ))}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={roleFilter}
          onValueChange={(v) => {
            setRoleFilter(v);
            setPage(1);
          }}
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="h-7 text-xs">
              {t("tabAll")}
            </TabsTrigger>
            <TabsTrigger value="student" className="h-7 text-xs">
              {t("tabStudents")}
            </TabsTrigger>
            <TabsTrigger value="teacher" className="h-7 text-xs">
              {t("tabTeachers")}
            </TabsTrigger>
            <TabsTrigger value="admin" className="h-7 text-xs">
              {t("tabAdmins")}
            </TabsTrigger>
            {isSuperuser && (
              <TabsTrigger value="superuser" className="h-7 text-xs">
                {t("tabSuperusers")}
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>
        <Input
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-8 w-full text-sm sm:w-64"
        />
      </div>

      <div className="overflow-hidden rounded border border-border">
        <div className="hidden sm:grid grid-cols-[1fr_200px_110px_90px_80px] gap-3 border-b border-border bg-muted/30 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>{t("colUser")}</span>
          <span>{t("colDisplayName")}</span>
          <span>{t("colRole")}</span>
          <span>{t("colRegistered")}</span>
          <span></span>
        </div>

        {usersQuery.isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <UserRowSkeleton key={i} />)
        ) : usersQuery.data?.users.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">{t("noResults")}</p>
        ) : (
          usersQuery.data?.users.map((u) => (
            <UserRow
              key={u.id}
              user={u}
              currentUserId={user.id}
              currentUserIsSuperuser={isSuperuser}
              isPending={pendingUserId === u.id}
              roleLabels={roleLabels}
              bannedBadge={t("bannedBadge")}
              superuserProtected={t("superuserProtected")}
              actionBan={t("actionBan")}
              actionUnban={t("actionUnban")}
              onRoleChange={(userId, role) => roleMutation.mutate({ userId, role })}
              onBanToggle={(userId, is_banned) => banMutation.mutate({ userId, is_banned })}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("paginationTotal", { count: usersQuery.data?.total ?? 0 })}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              {t("paginationBack")}
            </Button>
            <span className="font-mono text-xs text-muted-foreground">
              {t("pageOf", { page, total: totalPages })}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              {t("paginationNext")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}
