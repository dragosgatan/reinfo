"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth";
import { api, ApiError } from "@/lib/api";
import { ProblemDetailSchema } from "@/lib/types";
import { ProblemStatement } from "@/components/problems/problem-statement";
import { SubmissionPanel } from "@/components/problems/submission-panel";
import { DifficultyIndicator } from "@/components/problems/difficulty-indicator";

interface Props {
  contestSlug: string;
  problemSlug: string;
}

export default function ContestProblemClient({ contestSlug, problemSlug }: Props) {
  const t = useTranslations("problems");
  const { isAuthenticated } = useAuth();
  const [editorFocused, setEditorFocused] = useState(false);

  const { data: problem, isLoading, error } = useQuery({
    queryKey: ["problem", problemSlug],
    queryFn: () => api.get(`/api/problems/${problemSlug}`, ProblemDetailSchema),
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 2,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted-foreground">
        Se încarcă...
      </div>
    );
  }

  if (error || !problem) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center">
        <AlertCircle className="mx-auto mb-4 h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Problema nu a fost găsită.</p>
        <Link
          href={`/concursuri/${contestSlug}`}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          ← Înapoi la concurs
        </Link>
      </div>
    );
  }

  const submitUrl = `/api/contests/${contestSlug}/problems/${problemSlug}/submit`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <Link
          href={`/concursuri/${contestSlug}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Înapoi la concurs
        </Link>
      </div>

      <div
        className={`grid gap-6 ${editorFocused ? "lg:grid-cols-[360px_1fr]" : "lg:grid-cols-[1fr_360px]"}`}
      >
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold">{problem.title}</h1>
            <DifficultyIndicator difficulty={problem.difficulty} />
          </div>

          <Tabs defaultValue="statement">
            <TabsList className="mb-4">
              <TabsTrigger value="statement">{t("enunt")}</TabsTrigger>
            </TabsList>
            <TabsContent value="statement">
              <ProblemStatement markdown={problem.statement_md} />
            </TabsContent>
          </Tabs>
        </div>

        <div>
          <SubmissionPanel
            slug={problemSlug}
            scoreTotal={problem.score_total}
            bestScore={null}
            isAuthenticated={isAuthenticated}
            editorFocused={editorFocused}
            onToggleEditorFocus={() => setEditorFocused((v) => !v)}
            submitUrl={submitUrl}
          />
        </div>
      </div>
    </div>
  );
}
