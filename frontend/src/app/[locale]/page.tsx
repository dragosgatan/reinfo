import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Code2, Trophy, BookOpen, Users } from "lucide-react";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("home");
  return { title: t("title") };
}

const stats = [
  { key: "problems", value: "1 200+", icon: Code2 },
  { key: "users", value: "8 000+", icon: Users },
  { key: "submissions", value: "250 000+", icon: Trophy },
  { key: "contests", value: "45+", icon: BookOpen },
] as const;

const mockProblems = [
  "Suma elementelor",
  "Cel mai mare element",
  "Sortare",
  "Subsir crescator",
  "Dreptunghiuri",
];

export default function HomePage() {
  const t = useTranslations("home");
  const tCommon = useTranslations("common");

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6">
      <section className="py-16 md:py-24">
        <div className="max-w-2xl">
          <Badge variant="secondary" className="mb-4">
            Software Educațional · InfoEducație 2025
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-xl">
            {t("subtitle")}
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/invatare">
                {t("startLearning")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/probleme">{t("browseProblems")}</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-4 py-8 border-y border-border sm:grid-cols-4">
        {stats.map(({ key, value, icon: Icon }) => (
          <div key={key} className="text-center py-4">
            <Icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(`stats.${key}`)}</p>
          </div>
        ))}
      </section>

      <section className="py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold tracking-tight">{t("featuredProblems")}</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/probleme">
              {tCommon("viewAll")}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {mockProblems.map((name, i) => (
              <div
                key={i}
                className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
              >
                <span className="w-6 text-right text-muted-foreground font-mono text-xs">
                  {i + 1}
                </span>
                <Link
                  href={`/probleme/${name.toLowerCase().replace(/ /g, "-")}`}
                  className="font-medium hover:text-primary transition-colors flex-1"
                >
                  {name}
                </Link>
                <Badge
                  variant={i % 3 === 0 ? "success" : i % 3 === 1 ? "warning" : "destructive"}
                  className="ml-auto"
                >
                  {i % 3 === 0 ? "Ușor" : i % 3 === 1 ? "Mediu" : "Greu"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
