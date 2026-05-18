"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import {
  LobbyResponse,
  LobbyResponseSchema,
  ActiveDuelSummary,
  RecentDuelSummary,
  QueueEntryRead,
} from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Swords, Clock, Users, Trophy, X } from "lucide-react";

const TIME_CONTROLS = [
  { minutes: 15, label: "Rapid", description: "15 min" },
  { minutes: 30, label: "Standard", description: "30 min" },
  { minutes: 45, label: "Lung", description: "45 min" },
  { minutes: 60, label: "Maraton", description: "60 min" },
];

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  return `${Math.floor(diff / 3600)}h`;
}

function ActiveDuelRow({ duel }: { duel: ActiveDuelSummary }) {
  const locale = useLocale();
  const [elapsed, setElapsed] = useState(duel.seconds_elapsed);

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const totalSeconds = duel.time_limit_minutes * 60;
  const remaining = Math.max(0, totalSeconds - elapsed);
  const progress = (elapsed / totalSeconds) * 100;

  return (
    <Link
      href={`/${locale}/duel/${duel.id}`}
      className="group block rounded border border-border/50 p-3 hover:border-border hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-sm truncate">
            {duel.challenger_username}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {duel.challenger_rating}
          </span>
          <span className="text-muted-foreground text-xs shrink-0">vs</span>
          <span className="font-medium text-sm truncate">
            {duel.opponent_username}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {duel.opponent_rating}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs text-muted-foreground truncate max-w-[160px] hidden sm:block">
            {duel.problem_title}
          </span>
          <span
            className={`text-xs font-mono tabular-nums ${remaining < 120 ? "text-destructive" : "text-muted-foreground"}`}
          >
            {formatElapsed(remaining)}
          </span>
        </div>
      </div>
      <div className="mt-2 h-0.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary/40 transition-all duration-1000"
          style={{ width: `${Math.min(100, progress)}%` }}
        />
      </div>
    </Link>
  );
}

function RecentDuelRow({ duel }: { duel: RecentDuelSummary }) {
  const locale = useLocale();

  const resultLabel =
    duel.status === "drawn"
      ? "Remiză"
      : duel.winner_username
        ? duel.winner_username === duel.challenger_username
          ? `${duel.challenger_username} câștigă`
          : `${duel.opponent_username} câștigă`
        : "—";

  return (
    <Link
      href={`/${locale}/duel/${duel.id}`}
      className="group flex items-center justify-between gap-4 rounded border border-border/50 p-3 hover:border-border hover:bg-muted/30 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-sm truncate">
          {duel.challenger_username}{" "}
          <span className="text-xs text-muted-foreground">
            {duel.challenger_rating}
          </span>
        </span>
        <span className="text-muted-foreground text-xs shrink-0">vs</span>
        <span className="text-sm truncate">
          {duel.opponent_username}{" "}
          <span className="text-xs text-muted-foreground">
            {duel.opponent_rating}
          </span>
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-xs text-muted-foreground hidden sm:block">
          {resultLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatRelative(duel.finished_at)}
        </span>
      </div>
    </Link>
  );
}

function QueueCard({
  tc,
  count,
  inQueue,
  myEntry,
  onJoin,
  onLeave,
  joining,
  leaving,
}: {
  tc: (typeof TIME_CONTROLS)[number];
  count: number;
  inQueue: boolean;
  myEntry: QueueEntryRead | null;
  onJoin: (minutes: number) => void;
  onLeave: () => void;
  joining: boolean;
  leaving: boolean;
}) {
  const isMyTimeControl = myEntry?.time_limit_minutes === tc.minutes;

  return (
    <div
      className={`relative rounded-lg border p-5 flex flex-col gap-3 transition-colors ${
        isMyTimeControl
          ? "border-primary/60 bg-primary/5"
          : "border-border bg-card hover:border-border/80"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="font-semibold text-base">{tc.label}</div>
          <div className="text-sm text-muted-foreground">{tc.description}</div>
        </div>
        <Badge variant="secondary" className="text-xs gap-1">
          <Users className="w-3 h-3" />
          {count}
        </Badge>
      </div>

      {isMyTimeControl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Căutăm adversar…
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-destructive"
            onClick={onLeave}
            disabled={leaving}
          >
            {leaving ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <X className="w-3 h-3" />
            )}
            Anulează
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant={inQueue ? "ghost" : "outline"}
          className="w-full"
          onClick={() => onJoin(tc.minutes)}
          disabled={inQueue || joining}
        >
          {joining ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          {inQueue ? "Ocupat" : "Intră în coadă"}
        </Button>
      )}
    </div>
  );
}

export default function DuelLobbyPage() {
  const { user } = useAuth();
  const router = useRouter();
  const locale = useLocale();

  const [lobby, setLobby] = useState<LobbyResponse | null>(null);
  const [joining, setJoining] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLobby = async () => {
    try {
      const endpoint = user ? "/api/duels/lobby/me" : "/api/duels/lobby";
      const raw = await api.get(endpoint);
      const parsed = LobbyResponseSchema.safeParse(raw);
      if (parsed.success) {
        setLobby(parsed.data);
        // Redirect if matched
        if (parsed.data.your_queue_entry?.status === "matched") {
          const duelId = parsed.data.your_queue_entry.matched_duel_id;
          if (duelId) {
            router.push(`/${locale}/duel/${duelId}`);
          }
        }
      }
    } catch {
      // swallow
    }
  };

  useEffect(() => {
    fetchLobby();
    pollRef.current = setInterval(fetchLobby, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleJoin = async (minutes: number) => {
    if (!user) {
      router.push(`/${locale}/auth/login`);
      return;
    }
    setJoining(true);
    try {
      await api.post("/api/duels/queue/join", { time_limit_minutes: minutes });
      await fetchLobby();
    } catch {
      // swallow
    } finally {
      setJoining(false);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await api.delete("/api/duels/queue/leave");
      await fetchLobby();
    } catch {
      // swallow
    } finally {
      setLeaving(false);
    }
  };

  const myEntry = lobby?.your_queue_entry ?? null;
  const inQueue = myEntry?.status === "waiting";

  const queueCounts = lobby?.queue_counts ?? {};

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Swords className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dueluri</h1>
          <p className="text-sm text-muted-foreground">
            Provoacă un adversar de nivel similar la o problemă de programare
          </p>
        </div>
      </div>

      {/* Time controls */}
      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Timp de gândire
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {TIME_CONTROLS.map((tc) => (
            <QueueCard
              key={tc.minutes}
              tc={tc}
              count={Number(queueCounts[String(tc.minutes)] ?? 0)}
              inQueue={inQueue}
              myEntry={myEntry}
              onJoin={handleJoin}
              onLeave={handleLeave}
              joining={joining}
              leaving={leaving}
            />
          ))}
        </div>
        {!user && (
          <p className="text-xs text-muted-foreground mt-3">
            <Link
              href={`/${locale}/auth/login`}
              className="underline underline-offset-2"
            >
              Autentifică-te
            </Link>{" "}
            pentru a intra în coadă.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Active duels */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dueluri active
            </h2>
            {lobby && (
              <Badge variant="outline" className="text-xs ml-auto">
                {lobby.active_duels.length}
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            {lobby === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Se încarcă…
              </div>
            ) : lobby.active_duels.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Niciun duel activ momentan.
              </p>
            ) : (
              lobby.active_duels.map((d) => (
                <ActiveDuelRow key={d.id} duel={d} />
              ))
            )}
          </div>
        </div>

        {/* Recent duels */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Dueluri recente
            </h2>
          </div>
          <div className="space-y-2">
            {lobby === null ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Se încarcă…
              </div>
            ) : lobby.recent_duels.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">
                Niciun duel finalizat încă.
              </p>
            ) : (
              lobby.recent_duels.map((d) => (
                <RecentDuelRow key={d.id} duel={d} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
