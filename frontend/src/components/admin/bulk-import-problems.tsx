"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, ApiError } from "@/lib/api";
import { ALL_TAGS, ProblemReadSchema } from "@/lib/types";
import {
  downloadTextFile,
  parseCsv,
  parseJson,
  splitSemicolonList,
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

const bulkTestCaseSchema = z.object({
  input_content: z.string().min(1),
  output_content: z.string().min(1),
  score: z.coerce.number().int().min(0).default(10),
  is_sample: z.coerce.boolean().default(false),
});

const bulkQuizOptionSchema = z.object({
  text_md: z.string().min(1),
  is_correct: z.coerce.boolean().default(false),
  explanation_md: z.string().optional().default(""),
});

const bulkProblemSchema = z.object({
  slug: z
    .string()
    .min(1, "slug este obligatoriu")
    .max(128)
    .regex(/^[a-z0-9-]+$/, "doar litere mici, cifre și cratime"),
  title: z.string().min(1, "title este obligatoriu").max(256),
  statement_md: z.string().min(1, "statement_md este obligatoriu"),
  statement_md_en: z.string().optional().default(""),
  statement_md_hu: z.string().optional().default(""),
  input_format: z.string().optional().default(""),
  output_format: z.string().optional().default(""),
  difficulty: z.coerce.number().int().min(1, "1-10").max(10, "1-10"),
  tags: z
    .union([z.array(z.string()), z.string()])
    .optional()
    .transform((v) => (Array.isArray(v) ? v : splitSemicolonList(v)))
    .refine((tags) => tags.every((t) => (ALL_TAGS as readonly string[]).includes(t)), {
      message: `tag necunoscut, valori valide: ${ALL_TAGS.join(", ")}`,
    }),
  visibility: z.enum(["draft", "public", "private", "contest"]).optional().default("draft"),
  time_limit_ms: z.coerce.number().int().min(100).max(30000).optional().default(1000),
  memory_limit_kb: z.coerce.number().int().min(4096).max(524288).optional().default(65536),
  problem_type: z.enum(["standard", "quiz", "dataset"]).optional().default("standard"),
  test_cases: z.array(bulkTestCaseSchema).optional().default([]),
  quiz_options: z.array(bulkQuizOptionSchema).optional().default([]),
});

type BulkProblem = z.infer<typeof bulkProblemSchema>;

const CSV_TEMPLATE =
  "slug,title,statement_md,input_format,output_format,difficulty,tags,visibility,time_limit_ms,memory_limit_kb,problem_type\n" +
  'suma-elementelor,Suma elementelor,"Citiți n numere și afișați suma lor.","Pe prima linie n. Pe a doua linie n numere.","Suma.",2,"vectori;matematica",draft,1000,65536,standard\n';

const JSON_TEMPLATE = JSON.stringify(
  [
    {
      slug: "suma-elementelor",
      title: "Suma elementelor",
      statement_md: "Citiți n numere și afișați suma lor.",
      input_format: "Pe prima linie n. Pe a doua linie n numere.",
      output_format: "Suma.",
      difficulty: 2,
      tags: ["vectori", "matematica"],
      visibility: "draft",
      problem_type: "standard",
      test_cases: [
        { input_content: "3\n1 2 3\n", output_content: "6\n", score: 10, is_sample: true },
      ],
    },
  ],
  null,
  2,
);

function parseRows(raw: unknown[]): BulkRow<BulkProblem>[] {
  return raw.map((item, index) => {
    const result = bulkProblemSchema.safeParse(item);
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

async function createOneProblem(row: BulkProblem): Promise<void> {
  const isQuiz = row.problem_type === "quiz";

  const problem = await api.post(
    "/api/problems",
    {
      slug: row.slug,
      title: row.title,
      statement_md: row.statement_md,
      statement_md_en: row.statement_md_en || null,
      statement_md_hu: row.statement_md_hu || null,
      input_format: isQuiz ? "" : row.input_format,
      output_format: isQuiz ? "" : row.output_format,
      difficulty: row.difficulty,
      tags: row.tags,
      visibility: row.visibility,
      problem_type: row.problem_type,
      time_limit_ms: row.time_limit_ms,
      memory_limit_kb: row.memory_limit_kb,
      score_total: isQuiz
        ? 100
        : row.test_cases.reduce((sum, tc) => sum + tc.score, 0) || 100,
      comparison_mode: "whitespace_insensitive",
    },
    ProblemReadSchema,
  );

  if (isQuiz && row.quiz_options.length > 0) {
    await api.put(
      `/api/problems/${problem.slug}/quiz-options`,
      row.quiz_options.map((opt, i) => ({
        ordinal: i,
        text_md: opt.text_md,
        is_correct: opt.is_correct,
        explanation_md: opt.explanation_md || null,
      })),
    );
  }

  if (!isQuiz) {
    for (let i = 0; i < row.test_cases.length; i++) {
      const tc = row.test_cases[i];
      const formData = new FormData();
      formData.append("ordinal", String(i));
      formData.append("score", String(tc.score));
      formData.append("is_sample", String(tc.is_sample));
      formData.append("is_hidden", String(!tc.is_sample));
      formData.append(
        "input_file",
        new Blob([tc.input_content], { type: "text/plain" }),
        `${i}.in`,
      );
      formData.append(
        "output_file",
        new Blob([tc.output_content], { type: "text/plain" }),
        `${i}.out`,
      );

      const res = await fetch(`/api/problems/${problem.slug}/test-cases`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(`Test ${i + 1}: ${(payload as { detail?: string }).detail ?? "Eroare"}`);
      }
    }
  }
}

export function BulkImportProblems() {
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<BulkFormat>("csv");
  const [rows, setRows] = useState<BulkRow<BulkProblem>[]>([]);
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
        await createOneProblem(row.data);
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
    queryClient.invalidateQueries({ queryKey: ["problems"] });
    toast.success(`${next.filter((r) => r.status === "done").length} probleme create`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormatToggle format={format} onChange={(f) => { setFormat(f); setRows([]); setParseError(null); }} />
        <TemplateDownloadButton
          label={`Descarcă exemplu ${format.toUpperCase()}`}
          onClick={() =>
            format === "csv"
              ? downloadTextFile("probleme-exemplu.csv", CSV_TEMPLATE, "text/csv")
              : downloadTextFile("probleme-exemplu.json", JSON_TEMPLATE, "application/json")
          }
        />
      </div>

      <p className="text-xs text-muted-foreground">
        CSV: coloane <code className="rounded bg-muted px-1">slug,title,statement_md,input_format,output_format,difficulty,tags,visibility,time_limit_ms,memory_limit_kb,problem_type</code>{" "}
        (tags separate prin <code className="rounded bg-muted px-1">;</code>, fără cazuri de test - se adaugă
        ulterior din pagina problemei). JSON permite și <code className="rounded bg-muted px-1">test_cases</code>{" "}
        și <code className="rounded bg-muted px-1">quiz_options</code> incluse direct.
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
                  <th className="px-2 py-1.5 text-left">tip</th>
                  <th className="px-2 py-1.5 text-left">dificultate</th>
                  <th className="px-2 py-1.5 text-left">detalii</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.index} className="border-b border-border last:border-0">
                    <td className="px-2 py-1.5">
                      <RowStatusIcon status={row.status} />
                    </td>
                    <td className="px-2 py-1.5 font-mono">{row.data?.slug ?? "-"}</td>
                    <td className="px-2 py-1.5">{row.data?.title ?? "-"}</td>
                    <td className="px-2 py-1.5">{row.data?.problem_type ?? "-"}</td>
                    <td className="px-2 py-1.5">{row.data?.difficulty ?? "-"}</td>
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
            {importing ? "Se importă..." : `Importă ${validCount} probleme`}
          </Button>
        </div>
      )}
    </div>
  );
}
