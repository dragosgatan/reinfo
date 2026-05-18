import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { LessonView } from "./lesson-view";
import { LessonReadSchema, LessonListResponseSchema } from "@/lib/types";

interface Props {
  params: Promise<{ locale: string; slug: string }>;
}

async function fetchLesson(slug: string, cookieHeader: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/lessons/${slug}`,
      { headers: { cookie: cookieHeader }, cache: "no-store" },
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return LessonReadSchema.parse(await res.json());
  } catch {
    return null;
  }
}

async function fetchAllLessons(cookieHeader: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/lessons/`,
      { headers: { cookie: cookieHeader }, cache: "no-store" },
    );
    if (!res.ok) return [];
    return LessonListResponseSchema.parse(await res.json()).items;
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const lesson = await fetchLesson(slug, cookieHeader);
  if (!lesson) return {};
  return { title: lesson.title };
}

export default async function LessonPage({ params }: Props) {
  const { slug } = await params;
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");

  const [lesson, allLessons] = await Promise.all([
    fetchLesson(slug, cookieHeader),
    fetchAllLessons(cookieHeader),
  ]);

  if (!lesson) notFound();

  const siblings = allLessons
    .filter((l) => l.category === lesson.category)
    .sort((a, b) => a.ordinal - b.ordinal || a.title.localeCompare(b.title));

  const idx = siblings.findIndex((l) => l.slug === slug);
  const prevLesson = idx > 0 ? siblings[idx - 1] : null;
  const nextLesson = idx >= 0 && idx < siblings.length - 1 ? siblings[idx + 1] : null;

  return (
    <LessonView
      lesson={lesson}
      prevLesson={prevLesson}
      nextLesson={nextLesson}
    />
  );
}
