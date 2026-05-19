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

export default async function HomePage() {
  const [t, tCommon, problems] = await Promise.all([
    getTranslations("home"),
    getTranslations("common"),
    fetchFeaturedProblems(),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="relative overflow-hidden flex flex-col gap-4 border-b border-border py-10 sm:flex-row sm:items-end sm:justify-between md:py-14">
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {[
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/python/python-original.svg",       top: "12%",  right: "8%",  size: 38, opacity: 0.22 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/rust/rust-original.svg",           top: "55%",  right: "20%", size: 30, opacity: 0.09 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/go/go-original-wordmark.svg",      top: "20%",  right: "30%", size: 32, opacity: 0.09 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/cplusplus/cplusplus-original.svg", bottom: "10%", right: "10%", size: 32, opacity: 0.09 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/c/c-original.svg",                 top: "8%",   right: "48%", size: 28, opacity: 0.09 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/java/java-original.svg",           bottom: "12%", right: "42%", size: 32, opacity: 0.09 },
            { url: "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons/kotlin/kotlin-original.svg",       top: "42%",  right: "55%", size: 28, opacity: 0.09 },
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

        <div className="relative max-w-lg">
          <p className="mb-2 font-mono text-xs text-muted-foreground">
            {t("tagline")}
          </p>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t("title")}</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
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

      <div className="border-b border-border py-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Code2,
              title: "Gândit pentru Python",
              desc: "Rezolvă probleme direct în Python, limbajul ideal pentru cei care abia încep drumul în informatică.",
            },
            {
              icon: Trophy,
              title: "Dueluri 1v1",
              desc: "Provoacă prieteni sau adversari aleatorii la dueluri temporizate cu sistem de rating Elo.",
            },
            {
              icon: Users,
              title: "Experiență socială",
              desc: "Profiluri, listă de prieteni, clasamente și feed de activitate pentru o competiție reală.",
            },
            {
              icon: GraduationCap,
              title: "Unealtă pentru profesori",
              desc: "Creează clase, atribuie probleme și urmărește progresul elevilor dintr-un singur loc.",
            },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{title}</span>
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
                  {getDifficultyLabel(p.difficulty)}
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
