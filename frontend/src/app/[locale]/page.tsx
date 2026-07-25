import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyIndicator, getDifficultyLabel } from "@/components/problems/difficulty-indicator";
import { ArrowRight, Bot, Code2, Flag, FolderGit2, ListChecks, Swords } from "lucide-react";
import { ProblemListResponseSchema } from "@/lib/types";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("title") };
}

async function fetchFeaturedProblems() {
  const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  try {
    const res = await fetch(`${base}/api/problems?per_page=5&sort=most_solved`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ProblemListResponseSchema.parse(data).items;
  } catch {
    return [];
  }
}

function difficultyVariant(d: number): "success" | "warning" | "destructive" {
  if (d <= 3) return "success";
  if (d <= 6) return "warning";
  return "destructive";
}

const FEATURE_ICONS = [Code2, Bot, Flag, Swords, ListChecks, FolderGit2] as const;

export default async function HomePage() {
  const [t, tCommon, tProblems, problems] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("problems"),
    fetchFeaturedProblems(),
  ]);

  const features = [
    {
      icon: FEATURE_ICONS[0],
      title: t("features.pythonTitle"),
      desc: t("features.pythonDesc"),
      href: "/probleme",
    },
    {
      icon: FEATURE_ICONS[1],
      title: t("features.aiTitle"),
      desc: t("features.aiDesc"),
      href: "/probleme?tab=ai",
    },
    {
      icon: FEATURE_ICONS[2],
      title: t("features.ctfTitle"),
      desc: t("features.ctfDesc"),
      href: "/probleme?tab=ctf",
    },
    {
      icon: FEATURE_ICONS[3],
      title: t("features.duelsTitle"),
      desc: t("features.duelsDesc"),
      href: "/duel",
    },
    {
      icon: FEATURE_ICONS[4],
      title: t("features.prepTitle"),
      desc: t("features.prepDesc"),
      href: "/pregatire",
    },
    {
      icon: FEATURE_ICONS[5],
      title: t("features.projectsTitle"),
      desc: t("features.projectsDesc"),
      href: "/proiecte",
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative overflow-hidden flex flex-col gap-6 border-b border-border py-16 sm:flex-row sm:items-end sm:justify-between md:py-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            { url: "/logos/python.png", top: "10%",  right: "6%",  opacity: 0.22 },
            { url: "/logos/rust.png",   top: "55%",  right: "18%", opacity: 0.10 },
            { url: "/logos/go.png",     top: "18%",  right: "28%", opacity: 0.10 },
            { url: "/logos/cpp.png",    bottom: "12%", right: "8%",  opacity: 0.10 },
            { url: "/logos/c.png",      top: "8%",   right: "46%", opacity: 0.10 },
            { url: "/logos/java.png",   bottom: "14%", right: "40%", opacity: 0.10 },
            { url: "/logos/kotlin.png", top: "40%",  right: "52%", opacity: 0.10 },
            { url: "/logos/nodejs.png", top: "30%",  right: "38%", opacity: 0.10 },
          ].map(({ url, opacity, ...pos }, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="absolute select-none grayscale dark:invert"
              style={{ ...pos, maxWidth: 44, maxHeight: 44, width: "auto", height: "auto", opacity }}
            />
          ))}
        </div>

        <div className="relative max-w-xl">
          <p className="mb-3 font-mono text-xs text-muted-foreground">
            {t("tagline")}
          </p>
          <h1 className="text-3xl font-bold tracking-tight md:text-4xl lg:text-5xl">
            {t("title")}
          </h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>

        <div className="relative flex shrink-0 gap-2">
          <Button asChild size="sm">
            <Link href="/invatare">
              {t("startLearning")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/probleme">{t("browseProblems")}</Link>
          </Button>
        </div>
      </section>

      <div className="border-b border-border py-10">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, desc, href }, i) => (
            <Link
              key={title}
              href={href as Parameters<typeof Link>[0]["href"]}
              className="group flex flex-col gap-2 border-l border-border pl-4 transition-colors hover:border-foreground/40"
            >
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-medium tabular-nums text-muted-foreground/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium leading-snug group-hover:text-foreground">
                  {title}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {problems.length > 0 && (
        <section className="py-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("featuredProblems")}
            </h2>
            <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
              <Link href="/probleme">
                {tCommon("viewAll")}
                <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </div>
          <div className="overflow-hidden rounded border border-border divide-y divide-border">
            {problems.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/30"
              >
                <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                  {String(i + 1).padStart(3, "0")}
                </span>
                <Link
                  href={`/probleme/${p.slug}`}
                  className="flex-1 text-sm transition-colors hover:text-primary"
                >
                  {p.title}
                </Link>
                {p.tags[0] && (
                  <Badge variant="muted" className="hidden text-xs sm:inline-flex">
                    {p.tags[0]}
                  </Badge>
                )}
                <Badge variant={difficultyVariant(p.difficulty)} className="shrink-0 text-xs">
                  {getDifficultyLabel(p.difficulty, tProblems)}
                </Badge>
                <DifficultyIndicator difficulty={p.difficulty} className="hidden md:flex" />
                <span className="hidden w-16 text-right font-mono text-xs text-muted-foreground md:block">
                  {p.solve_count.toLocaleString("ro")} ac.
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="pb-8">
        <Badge variant="secondary" className="text-xs font-normal">
          Software Educațional · InfoEducație 2026
        </Badge>
      </div>
    </div>
  );
}
