"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Send, X } from "lucide-react";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { DirectMessageReadSchema, type DirectMessageRead } from "@/lib/types";
import { resolveMediaUrl, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  classId: string;
  otherUsername: string;
  otherDisplayName: string;
  otherAvatarUrl: string | null;
  onClose: () => void;
}

export function DmPanel({ classId, otherUsername, otherDisplayName, otherAvatarUrl, onClose }: Props) {
  const t = useTranslations("classroom.dms");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["dm", classId, otherUsername],
    queryFn: () =>
      api.get(
        `/api/classes/${classId}/dm/${otherUsername}`,
        z.array(DirectMessageReadSchema),
      ),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = body.trim();
    if (!text) return;
    setBody("");
    try {
      const dm = await api.post<DirectMessageRead>(
        `/api/classes/${classId}/dm/${otherUsername}`,
        { body: text },
      );
      queryClient.setQueryData<DirectMessageRead[]>(
        ["dm", classId, otherUsername],
        (prev) => (prev ? [...prev, dm] : [dm]),
      );
    } catch {
      toast.error(t("sendError"));
      setBody(text);
    }
  }

  return (
    <div className="flex flex-col h-full border border-border rounded-md overflow-hidden bg-background">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Avatar className="h-7 w-7 shrink-0">
          {otherAvatarUrl && <AvatarImage src={resolveMediaUrl(otherAvatarUrl)} />}
          <AvatarFallback className="text-xs">{otherUsername.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium flex-1 truncate">{otherDisplayName}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id;
          return (
            <div key={msg.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
              {!isMe && (
                <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                  {msg.sender_avatar_url && <AvatarImage src={resolveMediaUrl(msg.sender_avatar_url)} />}
                  <AvatarFallback className="text-[9px]">{msg.sender_username.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[75%]", isMe && "items-end flex flex-col")}>
                <div className={cn("rounded-lg px-3 py-2 text-sm", isMe ? "bg-primary text-primary-foreground" : "bg-muted")}>
                  {msg.body}
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(msg.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 px-3 py-2 border-t border-border shrink-0">
        <input
          className="flex-1 rounded-md border border-input bg-transparent px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder={t("placeholder")}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
        />
        <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleSend} disabled={!body.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}