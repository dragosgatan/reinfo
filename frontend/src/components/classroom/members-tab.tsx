"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserX, MessageSquare, Copy, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { type ClassDetail, type ClassMember } from "@/lib/types";
import { resolveMediaUrl } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { Link } from "@/i18n/navigation";
import { DmPanel } from "./dm-panel";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface Props {
  cls: ClassDetail;
  isTeacher: boolean;
  onClassUpdate: (updated: ClassDetail) => void;
}

export function MembersTab({ cls, isTeacher, onClassUpdate }: Props) {
  const t = useTranslations("classroom");
  const tCommon = useTranslations("common");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dmTarget, setDmTarget] = useState<ClassMember | null>(null);

  async function handleKick(memberId: string, username: string) {
    try {
      await api.delete(`/api/classes/${cls.id}/members/${memberId}`);
      onClassUpdate({ ...cls, members: cls.members.filter((m) => m.id !== memberId) });
      toast.success(t("memberKicked", { username }));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  async function handleRegenerateCode() {
    try {
      const updated = await api.post<ClassDetail>(`/api/classes/${cls.id}/regenerate-code`, {});
      queryClient.setQueryData(["class", cls.id], updated);
      onClassUpdate({ ...cls, join_code: updated.join_code });
      toast.success(t("codeRegenerated"));
    } catch {
      toast.error(tCommon("error"));
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(cls.join_code);
    toast.success(t("codeCopied"));
  }

  const teacher: ClassMember = {
    id: cls.teacher_id,
    username: cls.teacher_username,
    display_name: cls.teacher_display_name,
    avatar_url: cls.teacher_avatar_url,
  };

  const canDm = (member: ClassMember) => member.id !== user?.id;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {isTeacher && (
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("inviteCode")}</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-lg font-bold tracking-widest">{cls.join_code}</code>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={copyCode} title={t("copy")}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="icon" className="h-7 w-7" onClick={handleRegenerateCode} title={t("regenerate")}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{t("teacher")}</p>
          <MemberRow
            member={teacher}
            canKick={false}
            canDm={canDm(teacher)}
            onKick={() => {}}
            onDm={() => setDmTarget(teacher)}
          />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t("students")} ({cls.members.length})
          </p>
          {cls.members.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {cls.members.map((m) => (
                <MemberRow
                  key={m.id}
                  member={m}
                  canKick={isTeacher}
                  canDm={canDm(m)}
                  onKick={() => handleKick(m.id, m.username)}
                  onDm={() => setDmTarget(m)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      {dmTarget && (
        <div className="h-[480px] lg:sticky lg:top-20">
          <DmPanel
            classId={cls.id}
            otherUsername={dmTarget.username}
            otherDisplayName={dmTarget.display_name}
            otherAvatarUrl={dmTarget.avatar_url}
            onClose={() => setDmTarget(null)}
          />
        </div>
      )}
    </div>
  );
}

function MemberRow({
  member,
  canKick,
  canDm,
  onKick,
  onDm,
}: {
  member: ClassMember;
  canKick: boolean;
  canDm: boolean;
  onKick: () => void;
  onDm: () => void;
}) {
  const t = useTranslations("classroom");

  return (
    <li className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors">
      <Link href={`/u/${member.username}`} className="flex items-center gap-2.5 flex-1 min-w-0">
        <Avatar className="h-8 w-8 shrink-0">
          {member.avatar_url && <AvatarImage src={resolveMediaUrl(member.avatar_url)} />}
          <AvatarFallback className="text-xs">{member.username.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{member.display_name}</p>
          <p className="text-xs text-muted-foreground truncate">@{member.username}</p>
        </div>
      </Link>
      <div className="flex gap-1 shrink-0">
        {canDm && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDm} title={t("privateMessage")}>
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
        )}
        {canKick && (
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onKick} title={t("removeFromClass")}>
            <UserX className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </li>
  );
}