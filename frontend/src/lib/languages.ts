"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { LanguageListSchema } from "@/lib/types";
import type { Language } from "@/lib/types";

export function useLanguages() {
  const { data, isLoading } = useQuery({
    queryKey: ["languages"],
    queryFn: () => api.get("/api/languages", LanguageListSchema),
    staleTime: Infinity,
  });

  const languages = data ?? [];
  const stableLanguages = languages.filter((lang) => lang.stable);

  const bySlug = languages.reduce<Record<string, Language>>((acc, lang) => {
    acc[lang.slug] = lang;
    return acc;
  }, {});

  return { languages: stableLanguages, allLanguages: languages, bySlug, isLoading };
}
