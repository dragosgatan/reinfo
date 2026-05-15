import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

interface Props {
  params: Promise<{ username: string; locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: username };
}

const mockSubmissions = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  problemSlug: `problema-${i + 1}`,
  problemTitle: `Problema ${i + 1}`,
  score: [100, 80, 60, 100, 40, 100, 70, 100][i],
  submittedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
}));

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const t = await getTranslations("profile");

  const joinedAt = new Date(2024, 8, 1).toISOString();
  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className="font-mono text-sm">{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <h1 className="text-xl font-bold tracking-tight">{username}</h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("joinedAt")} {formatDate(joinedAt)}
            </span>
            <span>
              <span className="font-mono font-semibold text-foreground">42</span>{" "}
              {t("solvedProblems").toLowerCase()}
            </span>
            <span>
              <span className="font-mono font-semibold text-foreground">128</span>{" "}
              {t("submissions").toLowerCase()}
            </span>
            <span>
              <span className="font-mono font-semibold text-foreground">3 200</span> puncte
            </span>
          </div>
        </div>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">{t("submissions")}</TabsTrigger>
          <TabsTrigger value="solved">{t("solvedProblems")}</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4">
          <div className="overflow-hidden rounded border border-border divide-y divide-border">
            {mockSubmissions.map((sub) => (
              <div
                key={sub.id}
                className="flex items-center gap-4 px-4 py-2.5 text-sm transition-colors hover:bg-muted/30"
              >
                <Link
                  href={`/probleme/${sub.problemSlug}`}
                  className="flex-1 transition-colors hover:text-primary"
                >
                  {sub.problemTitle}
                </Link>
                <Badge
                  variant={
                    sub.score === 100 ? "success" : sub.score >= 60 ? "warning" : "destructive"
                  }
                >
                  {sub.score} pct
                </Badge>
                <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                  {formatDate(sub.submittedAt)}
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="solved" className="mt-4">
          <p className="text-sm text-muted-foreground">{t("solvedProblems")}: 42</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
