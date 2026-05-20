import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DifficultyIndicator, getDifficultyLabel } from "@/components/problems/difficulty-indicator";
import { ArrowRight, Code2, Trophy, Users, GraduationCap } from "lucide-react";
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

const FEATURE_ICONS = [Code2, Trophy, Users, GraduationCap] as const;

export default async function HomePage() {
  const [t, tCommon, tProblems, problems] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    getTranslations("problems"),
    fetchFeaturedProblems(),
  ]);

  const features = [
    { icon: FEATURE_ICONS[0], title: t("features.pythonTitle"), desc: t("features.pythonDesc") },
    { icon: FEATURE_ICONS[1], title: t("features.duelsTitle"), desc: t("features.duelsDesc") },
    { icon: FEATURE_ICONS[2], title: t("features.socialTitle"), desc: t("features.socialDesc") },
    {
      icon: FEATURE_ICONS[3],
      title: t("features.teachersTitle"),
      desc: t("features.teachersDesc"),
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative overflow-hidden flex flex-col gap-6 border-b border-border py-16 sm:flex-row sm:items-end sm:justify-between md:py-24">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg",       top: "10%",  right: "6%",  size: 44, opacity: 0.22 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg",           top: "55%",  right: "18%", size: 34, opacity: 0.10 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original-wordmark.svg",      top: "18%",  right: "28%", size: 36, opacity: 0.10 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg", bottom: "12%", right: "8%",  size: 36, opacity: 0.10 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-original.svg",                 top: "8%",   right: "46%", size: 30, opacity: 0.10 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg",           bottom: "14%", right: "40%", size: 34, opacity: 0.10 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kotlin/kotlin-original.svg",       top: "40%",  right: "52%", size: 30, opacity: 0.10 },
          ].map(({ url, size, opacity, ...pos }, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={url}
              alt=""
              className="absolute select-none grayscale dark:invert"
              style={{ ...pos, width: size, height: size, opacity }}
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
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map(({ icon: Icon, title, desc }, i) => (
            <div key={title} className="flex flex-col gap-2 border-l border-border pl-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-medium tabular-nums text-muted-foreground/50">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-medium leading-snug">{title}</span>
              </div>
              <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
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
