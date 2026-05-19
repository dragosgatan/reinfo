"use client";

import { useEffect, useRef, useState } from "react";
import { Search, BookOpen, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { api } from "@/lib/api";
import { ProblemListResponseSchema, UserPublicSchema } from "@/lib/types";
import { z } from "zod";
import { cn } from "@/lib/utils";

function useDebouncedValue(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

interface ProblemHit {
  kind: "problem";
  slug: string;
  title: string;
  difficulty: number;
}

interface UserHit {
  kind: "user";
  username: string;
  display_name: string;
  avatar_url: string | null;
}

type Hit = ProblemHit | UserHit;

export function SearchBar() {
  const t = useTranslations("nav");
  const router = useRouter();
  const [value, setValue] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(value.trim(), 200);

  useEffect(() => {
    if (debounced.length < 2) {
      setHits([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    Promise.all([
      api
        .get(`/api/problems?search=${encodeURIComponent(debounced)}&per_page=5`, ProblemListResponseSchema)
        .then((r) => r.items.map((p): ProblemHit => ({ kind: "problem", slug: p.slug, title: p.title, difficulty: p.difficulty })))
        .catch(() => [] as ProblemHit[]),
      api
        .get(`/api/users/search?q=${encodeURIComponent(debounced)}&limit=5`, z.array(UserPublicSchema))
        .then((users) => users.map((u): UserHit => ({ kind: "user", username: u.username, display_name: u.display_name, avatar_url: u.avatar_url })))
        .catch(() => [] as UserHit[]),
    ]).then(([problems, users]) => {
      if (cancelled) return;
      const combined: Hit[] = [...users, ...problems];
      setHits(combined);
      setOpen(combined.length > 0);
      setSelected(-1);
    });

    return () => {
      cancelled = true;
    };
  }, [debounced]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    if (selected >= 0 && hits[selected]) {
      navigateToHit(hits[selected]);
    } else {
      router.push(`/probleme?q=${encodeURIComponent(value.trim())}`);
    }
    close();
  }

  function navigateToHit(hit: Hit) {
    if (hit.kind === "problem") router.push(`/probleme/${hit.slug}`);
    else router.push(`/u/${hit.username}`);
    close();
  }

  function close() {
    setValue("");
    setOpen(false);
    setSelected(-1);
    inputRef.current?.blur();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, hits.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setSelected(-1);
    }
  }

  function difficultyColor(d: number) {
    if (d <= 3) return "text-emerald-600 dark:text-emerald-400";
    if (d <= 6) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <form onSubmit={handleSubmit}>
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => hits.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={t("searchPlaceholder")}
          className="h-8 w-52 rounded-md border border-input bg-transparent pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring lg:w-64"
          aria-label={t("search")}
          autoComplete="off"
        />
      </form>

      {open && hits.length > 0 && (
        <div className="absolute left-0 top-full mt-1 w-full min-w-[280px] overflow-hidden rounded-md border border-border bg-popover shadow-md z-50">
          {hits.map((hit, i) => (
            <button
              key={hit.kind === "problem" ? hit.slug : hit.username}
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => navigateToHit(hit)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors",
                i === selected ? "bg-accent" : "hover:bg-muted",
              )}
            >
              {hit.kind === "user" ? (
                <>
                  <User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate font-medium">{hit.display_name}</span>
                  <span className="text-xs text-muted-foreground">@{hit.username}</span>
                </>
              ) : (
                <>
                  <BookOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{hit.title}</span>
                  <span className={cn("text-xs font-mono tabular-nums", difficultyColor(hit.difficulty))}>
                    {hit.difficulty}
                  </span>
                </>
              )}
            </button>
          ))}
          {value.trim().length >= 2 && (
            <button
              type="button"
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => {
                router.push(`/probleme?q=${encodeURIComponent(value.trim())}`);
                close();
              }}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Search className="h-3 w-3" />
              Toate problemele pentru &ldquo;{value.trim()}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
