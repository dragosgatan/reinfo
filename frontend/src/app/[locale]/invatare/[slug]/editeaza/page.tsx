"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { LessonReadSchema } from "@/lib/types";
import { LessonEditor } from "@/components/lessons/lesson-editor";
import { Link } from "@/i18n/navigation";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  params: { slug: string };
}

export default function EditeazaLectiePage({ params }: Props) {
  const { slug } = params;
  const { user, isLoading: authLoading } = useAuth();

  const { data: lesson, isLoading: lessonLoading } = useQuery({
    queryKey: ["lesson", slug],
    queryFn: () => api.get(`/api/lessons/${slug}`, LessonReadSchema),
    enabled: !!user && (user.role === "teacher" || user.role === "admin"),
  });

  if (authLoading || lessonLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user || (user.role !== "teacher" && user.role !== "admin")) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">
          Trebuie să fii profesor sau administrator pentru a edita lecții.
        </p>
        <Link
          href={`/invatare/${slug}`}
          className="mt-4 inline-block text-sm text-primary hover:underline"
        >
          ← Înapoi la lecție
        </Link>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">Lecția nu a fost găsită.</p>
        <Link href="/invatare" className="mt-4 inline-block text-sm text-primary hover:underline">
          ← Înapoi la lecții
        </Link>
      </div>
    );
  }

  return <LessonEditor initial={lesson} />;
}
