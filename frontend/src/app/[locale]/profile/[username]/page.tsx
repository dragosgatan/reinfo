import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/utils";
import { CalendarDays, CheckCircle2, Send } from "lucide-react";

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
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar className="h-16 w-16 text-lg">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{username}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Utilizator ReInfo</p>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            {t("joinedAt")} {formatDate(joinedAt)}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              42
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t("solvedProblems")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              128
            </p>
            <p className="text-xs text-muted-foreground mt-1">{t("submissions")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-2xl font-bold tracking-tight">3 200</p>
            <p className="text-xs text-muted-foreground mt-1">Puncte totale</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="submissions">
        <TabsList>
          <TabsTrigger value="submissions">{t("submissions")}</TabsTrigger>
          <TabsTrigger value="solved">{t("solvedProblems")}</TabsTrigger>
        </TabsList>

        <TabsContent value="submissions" className="mt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {mockSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center gap-4 px-4 py-3 text-sm hover:bg-muted/40 transition-colors"
                >
                  <Link
                    href={`/probleme/${sub.problemSlug}`}
                    className="flex-1 font-medium hover:text-primary transition-colors"
                  >
                    {sub.problemTitle}
                  </Link>
                  <Badge
                    variant={sub.score === 100 ? "success" : sub.score >= 60 ? "warning" : "destructive"}
                  >
                    {sub.score} pct
                  </Badge>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {formatDate(sub.submittedAt)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="solved" className="mt-4">
          <p className="text-sm text-muted-foreground">{t("solvedProblems")}: 42</p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
