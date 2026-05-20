"use client";

import { useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { z } from "zod";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { ClassMessageReadSchema } from "@/lib/types";
import { resolveMediaUrl, formatDate } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { useClassChat } from "@/lib/use-class-chat";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Props {
  classId: string;
}

export function ClassChatTab({ classId }: Props) {
  const t = useTranslations("classroom.chatTab");
  const { user } = useAuth();
  const [body, setBody] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { status } = useClassChat(classId);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["class-messages", classId],
    queryFn: () =>
      api.get(`/api/classes/${classId}/messages`, z.array(ClassMessageReadSchema)),
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
      await api.post(`/api/classes/${classId}/messages`, { body: text });
    } catch {
      toast.error(t("sendError"));
      setBody(text);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[560px] rounded-md border border-border overflow-hidden bg-background">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <span className="text-sm font-medium">{t("title")}</span>
        <span
          className={cn(
            "flex items-center gap-1.5 text-xs",
            status === "live" ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
          )}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              status === "live" ? "bg-emerald-500" : "bg-muted-foreground",
            )}
          />
          {status === "live" ? t("live") : status === "connecting" ? t("connecting") : t("disconnected")}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">
            {t("empty")}
          </p>
        )}
        {messages.map((msg) => {
          const isMe = msg.author_id === user?.id;
          return (
            <div key={msg.id} className={cn("flex gap-2", isMe && "flex-row-reverse")}>
              {!isMe && (
                <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                  {msg.author_avatar_url && (
                    <AvatarImage src={resolveMediaUrl(msg.author_avatar_url)} />
                  )}
                  <AvatarFallback className="text-[9px]">
                    {msg.author_username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className={cn("max-w-[70%]", isMe && "items-end flex flex-col")}>
                {!isMe && (
                  <p className="text-xs text-muted-foreground mb-0.5">{msg.author_display_name}</p>
                )}
                <div
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    isMe ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          className="h-9 w-9 shrink-0"
          onClick={handleSend}
          disabled={!body.trim()}
        >
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}