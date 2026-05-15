import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("title") };
}

const mockProblems = [
  { name: "Suma elementelor", difficulty: "easy" as const, tag: "vectori", solveRate: 78 },
  { name: "Cel mai mare element", difficulty: "easy" as const, tag: "vectori", solveRate: 65 },
  { name: "Sortare", difficulty: "medium" as const, tag: "sortare", solveRate: 52 },
  { name: "Subsir crescator", difficulty: "medium" as const, tag: "dp", solveRate: 38 },
  { name: "Dreptunghiuri", difficulty: "hard" as const, tag: "geometrie", solveRate: 21 },
];

const difficultyLabel = {
  easy: "Ușor",
  medium: "Mediu",
  hard: "Greu",
} as const;

const difficultyVariant = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
} as const;

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

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

      <div className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border py-3 text-sm text-muted-foreground">
        <span>
          <span className="font-mono font-semibold text-foreground">1 200+</span>{" "}
          {t("stats.problems")}
        </span>
        <span>
          <span className="font-mono font-semibold text-foreground">8 000+</span>{" "}
          {t("stats.users")}
        </span>
        <span>
          <span className="font-mono font-semibold text-foreground">250 000+</span>{" "}
          {t("stats.submissions")}
        </span>
        <span>
          <span className="font-mono font-semibold text-foreground">45+</span>{" "}
          {t("stats.contests")}
        </span>
      </div>

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
          {mockProblems.map((p, i) => (
            <div
              key={i}
              className="flex items-center gap-4 px-4 py-2.5 transition-colors hover:bg-muted/30"
            >
              <span className="w-8 shrink-0 text-right font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(3, "0")}
              </span>
              <Link
                href={`/probleme/${p.name.toLowerCase().replace(/ /g, "-")}`}
                className="flex-1 text-sm transition-colors hover:text-primary"
              >
                {p.name}
              </Link>
              <Badge variant="muted" className="hidden text-xs sm:inline-flex">
                {p.tag}
              </Badge>
              <Badge variant={difficultyVariant[p.difficulty]} className="shrink-0 text-xs">
                {difficultyLabel[p.difficulty]}
              </Badge>
              <span className="hidden w-10 text-right font-mono text-xs text-muted-foreground md:block">
                {p.solveRate}%
              </span>
            </div>
          ))}
        </div>
      </section>

      <div className="pb-8">
        <Badge variant="secondary" className="text-xs font-normal">
          Software Educațional · InfoEducație 2025
        </Badge>
      </div>
    </div>
  );
}
