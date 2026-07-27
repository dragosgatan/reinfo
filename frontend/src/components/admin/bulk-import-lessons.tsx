"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { LESSON_CATEGORIES, LESSON_LEVELS, LessonReadSchema } from "@/lib/types";
import {
  downloadTextFile,
  parseBoolean,
  parseCsv,
  parseJson,
  type BulkFormat,
  type BulkRow,
} from "@/lib/bulk-import";
import {
  FileOrPasteInput,
  FormatToggle,
  ImportSummary,
  RowStatusIcon,
  TemplateDownloadButton,
} from "./bulk-import-shared";

const bulkQuizSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  options: z.array(z.string()).min(2).max(6),
  correct: z.coerce.number().int().min(0),
  explanation: z.string().optional().default(""),
});

const bulkLessonSchema = z.object({
  slug: z
    .string()
    .min(1, "slug este obligatoriu")
    .max(128)
    .regex(/^[a-z0-9-]+$/, "doar litere mici, cifre și cratime"),
  title: z.string().min(1, "title este obligatoriu").max(256),
  category: z.enum(LESSON_CATEGORIES, {
    errorMap: () => ({ message: `valori valide: ${LESSON_CATEGORIES.join(", ")}` }),
  }),
  level: z.enum(LESSON_LEVELS, {
    errorMap: () => ({ message: `valori valide: ${LESSON_LEVELS.join(", ")}` }),
  }),
  content_md: z.string().optional().default(""),
  content_md_en: z.string().optional().default(""),
  content_md_hu: z.string().optional().default(""),
  teacher_notes_md: z.string().optional().default(""),
  ordinal: z.coerce.number().int().min(0).optional().default(0),
  published: z.preprocess((v) => parseBoolean(v, false), z.boolean()).optional().default(false),
  quizzes: z.array(bulkQuizSchema).optional().default([]),
});

type BulkLesson = z.infer<typeof bulkLessonSchema>;

const CSV_TEMPLATE =
  "slug,title,category,level,content_md,ordinal,published\n" +
  'ce-este-un-algoritm,Ce este un algoritm,basics,beginner,"Un algoritm este o secvență de pași...",0,false\n';

const JSON_TEMPLATE = JSON.stringify(
  [
    {
      slug: "ce-este-un-algoritm",
      title: "Ce este un algoritm",
      category: "basics",
      level: "beginner",
      content_md: "Un algoritm este o secvență de pași...",
      ordinal: 0,
      published: false,
      quizzes: [
        {
          id: "q1",
          question: "Ce este un algoritm?",
          options: ["O secvență de pași", "Un limbaj de programare"],
          correct: 0,
          explanation: "Un algoritm descrie pașii pentru rezolvarea unei probleme.",
        },
      ],
    },
  ],
  null,
  2,
);

function parseRows(raw: unknown[]): BulkRow<BulkLesson>[] {
  return raw.map((item, index) => {
    const result = bulkLessonSchema.safeParse(item);
    if (result.success) {
      return { index, data: result.data, validationErrors: [], status: "pending" as const };
    }
    return {
      index,
      data: null,
      validationErrors: result.error.issues.map((i) => `${i.path.join(".") || "?"}: ${i.message}`),
      status: "pending" as const,
    };
  });
}

async function createOneLesson(row: BulkLesson): Promise<void> {
  await api.post(
    "/api/lessons",
    {
      slug: row.slug,
      title: row.title,
      category: row.category,
      level: row.level,
      content_md: row.content_md,
      content_md_en: row.content_md_en || null,
      content_md_hu: row.content_md_hu || null,
      teacher_notes_md: row.teacher_notes_md || null,
      ordinal: row.ordinal,
      published: row.published,
      quizzes: row.quizzes,
    },
    LessonReadSchema,
  );
}

export function BulkImportLessons() {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<BulkFormat>("csv");
  const [rows, setRows] = useState<BulkRow<BulkLesson>[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleText(text: string) {
    setParseError(null);
    if (!text.trim()) {
      setRows([]);
      return;
    }
    try {
      const raw = format === "csv" ? parseCsv(text) : parseJson(text);
      setRows(parseRows(raw));
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Eroare la parsare");
      setRows([]);
    }
  }

  const validCount = useMemo(() => rows.filter((r) => r.data !== null).length, [rows]);
  const doneCount = rows.filter((r) => r.status === "done").length;
  const failedCount = rows.filter((r) => r.status === "error").length;

  async function handleImport() {
    setImporting(true);
    const next = [...rows];
    for (let i = 0; i < next.length; i++) {
      const row = next[i];
      if (!row.data) continue;
      next[i] = { ...row, status: "creating" };
      setRows([...next]);
      try {
        await createOneLesson(row.data);
        next[i] = { ...row, status: "done" };
      } catch (err) {
        next[i] = {
          ...row,
          status: "error",
          resultError:
            err instanceof ApiError && err.status === 409
              ? "slug există deja"
              : err instanceof Error
                ? err.message
                : "Eroare necunoscută",
        };
      }
      setRows([...next]);
    }
    setImporting(false);
    queryClient.invalidateQueries({ queryKey: ["lessons"] });
    toast.success(`${next.filter((r) => r.status === "done").length} lecții create`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormatToggle format={format} onChange={(f) => { setFormat(f); setRows([]); setParseError(null); }} />
        <TemplateDownloadButton
          label={`Descarcă exemplu ${format.toUpperCase()}`}
          onClick={() =>
            format === "csv"
              ? downloadTextFile("lectii-exemplu.csv", CSV_TEMPLATE, "text/csv")
              : downloadTextFile("lectii-exemplu.json", JSON_TEMPLATE, "application/json")
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        CSV: coloane <code className="rounded bg-muted px-1">slug,title,category,level,content_md,ordinal,published</code>{" "}
        (fără quiz-uri — se pot adăuga ulterior din editor). category:{" "}
        <code className="rounded bg-muted px-1">{LESSON_CATEGORIES.join(", ")}</code>, level:{" "}
        <code className="rounded bg-muted px-1">{LESSON_LEVELS.join(", ")}</code>. JSON permite și{" "}
        <code className="rounded bg-muted px-1">quizzes</code> incluse direct.
      </p>

      <FileOrPasteInput format={format} onText={handleText} accept={format === "csv" ? ".csv" : ".json"} />

      {parseError && <p className="text-xs text-destructive">{parseError}</p>}

      {rows.length > 0 && (
        <div className="space-y-3">
          <ImportSummary total={rows.length} valid={validCount} done={doneCount} failed={failedCount} />

          <div className="max-h-96 overflow-y-auto rounded border border-border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/50">
                <tr className="border-b border-border">
                  <th className="w-8 px-2 py-1.5 text-left"></th>
                  <th className="px-2 py-1.5 text-left">slug</th>
                  <th className="px-2 py-1.5 text-left">title</th>
                  <th className="px-2 py-1.5 text-left">categorie</th>
                  <th className="px-2 py-1.5 text-left">nivel</th>
                  <th className="px-2 py-1.5 text-left">detalii</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.index} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5">
                      <RowStatusIcon status={row.status} />
                    </td>
                    <td className="px-2 py-1.5 font-mono">{row.data?.slug ?? "—"}</td>
                    <td className="px-2 py-1.5">{row.data?.title ?? "—"}</td>
                    <td className="px-2 py-1.5">{row.data?.category ?? "—"}</td>
                    <td className="px-2 py-1.5">{row.data?.level ?? "—"}</td>
                    <td className="px-2 py-1.5 text-destructive">
                      {row.validationErrors.join("; ")}
                      {row.resultError}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button
            type="button"
            size="sm"
            disabled={validCount === 0 || importing}
            onClick={handleImport}
          >
            {importing ? "Se importă..." : `Importă ${validCount} lecții`}
          </Button>
        </div>
      )}
    </div>
  );
}
