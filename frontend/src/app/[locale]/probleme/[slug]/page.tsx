import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Download, Upload, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";

interface Props {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug };
}

export default async function ProblemPage({ params }: Props) {
  const { slug } = await params;
  const t = await getTranslations("problems");

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link
        href="/probleme"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        {t("title")}
      </Link>

      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight capitalize">
              {slug.replace(/-/g, " ")}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant="success">{t("difficultyLevels.easy")}</Badge>
              <Badge variant="muted">vectori</Badge>
              <Badge variant="muted">sortare</Badge>
              <span className="font-mono text-xs text-muted-foreground">100 pct</span>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Download className="h-4 w-4" />
              {t("downloadInput")}
            </Button>
            <Button size="sm" className="gap-1.5">
              <Upload className="h-4 w-4" />
              {t("uploadOutput")}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_240px]">
        <div>
          <Tabs defaultValue="statement">
            <TabsList>
              <TabsTrigger value="statement">{t("statement")}</TabsTrigger>
              <TabsTrigger value="examples">{t("examples")}</TabsTrigger>
              <TabsTrigger value="submissions">{t("mySubmissions")}</TabsTrigger>
            </TabsList>

            <TabsContent value="statement" className="mt-4 space-y-4 text-sm leading-7">
              <p>
                Se dă un vector cu <em>n</em> numere naturale. Să se determine suma elementelor.
              </p>
              <Separator />
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Date de intrare
                  </h3>
                  <p>
                    Prima linie conține <em>n</em>. A doua linie conține cele <em>n</em> numere.
                  </p>
                </div>
                <div>
                  <h3 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Date de ieșire
                  </h3>
                  <p>Se va afișa suma elementelor vectorului.</p>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="examples" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Input
                  </p>
                  <pre className="overflow-x-auto rounded border border-border bg-muted px-4 py-3 font-mono text-sm leading-relaxed scrollbar-thin">
                    {`5\n1 2 3 4 5`}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Output
                  </p>
                  <pre className="overflow-x-auto rounded border border-border bg-muted px-4 py-3 font-mono text-sm leading-relaxed scrollbar-thin">
                    {`15`}
                  </pre>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="submissions" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Autentifică-te pentru a vedea submisiile tale.
              </p>
            </TabsContent>
          </Tabs>
        </div>

        <aside className="space-y-4">
          <div className="rounded border border-border p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("submitSolution")}
            </p>
            <div className="mb-4 space-y-2">
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-primary shrink-0">01.</span>
                Descarcă fișierul de intrare
              </div>
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-primary shrink-0">02.</span>
                Rulează soluția local
              </div>
              <div className="flex items-start gap-2.5 text-xs text-muted-foreground">
                <span className="font-mono font-semibold text-primary shrink-0">03.</span>
                Încarcă fișierul de ieșire
              </div>
            </div>
            <div className="space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">problema.in</span>
              </Button>
              <Button variant="outline" size="sm" className="w-full justify-start gap-2">
                <Download className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs">problema.ok</span>
              </Button>
            </div>
            <Button size="sm" className="mt-3 w-full gap-2">
              <Upload className="h-3.5 w-3.5" />
              {t("uploadOutput")}
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}
