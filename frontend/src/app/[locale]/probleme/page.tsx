import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import type { Metadata } from "next";
import { Search, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("problems");
  return { title: t("title") };
}

const difficultyVariant = {
  easy: "success",
  medium: "warning",
  hard: "destructive",
} as const;

const mockProblems = Array.from({ length: 20 }, (_, i) => ({
  id: i + 1,
  slug: `problema-${i + 1}`,
  title: `Problema ${i + 1}`,
  difficulty: (["easy", "medium", "hard"] as const)[i % 3],
  tags: [["vectori", "sortare", "dp", "grafuri"][i % 4]],
  submissions: Math.floor(Math.random() * 5000) + 100,
  source: "pbinfo",
}));

export default function ProblemePage() {
  const t = useTranslations("problems");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <div className="mb-4 flex gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            className="h-8 pl-8 text-sm"
            aria-label={t("search")}
          />
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filtre
        </Button>
      </div>

      <div className="overflow-hidden rounded border border-border">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-16 font-mono text-xs">#</TableHead>
              <TableHead>{t("title")}</TableHead>
              <TableHead className="hidden sm:table-cell">{t("tags")}</TableHead>
              <TableHead className="w-24">{t("difficulty")}</TableHead>
              <TableHead className="hidden w-28 text-right md:table-cell">
                {t("submissions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockProblems.map((problem) => (
              <TableRow key={problem.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {String(problem.id).padStart(4, "0")}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/probleme/${problem.slug}`}
                    className="font-medium transition-colors hover:text-primary"
                  >
                    {problem.title}
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {problem.tags.map((tag) => (
                      <Badge key={tag} variant="muted" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={difficultyVariant[problem.difficulty]}>
                    {t(`difficultyLevels.${problem.difficulty}`)}
                  </Badge>
                </TableCell>
                <TableCell className="hidden text-right font-mono text-xs text-muted-foreground md:table-cell">
                  {problem.submissions.toLocaleString("ro")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
