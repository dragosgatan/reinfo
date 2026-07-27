import Papa from "papaparse";

export type BulkFormat = "csv" | "json";

export type RowStatus = "pending" | "creating" | "done" | "error";

export interface BulkRow<T> {
  index: number;
  data: T | null;
  validationErrors: string[];
  status: RowStatus;
  resultError?: string;
}

export function parseCsv(text: string): Record<string, string>[] {
  const result = Papa.parse<Record<string, string>>(text.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });
  return result.data;
}

export function parseJson(text: string): unknown[] {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed)) {
    throw new Error("JSON root must be an array of objects");
  }
  return parsed;
}

export function splitSemicolonList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(";")
    .map((v) => v.trim())
    .filter(Boolean);
}

export function parseBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const v = value.trim().toLowerCase();
    if (v === "true" || v === "1" || v === "yes" || v === "da") return true;
    if (v === "false" || v === "0" || v === "no" || v === "nu" || v === "") return false;
  }
  return fallback;
}

export function downloadTextFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
