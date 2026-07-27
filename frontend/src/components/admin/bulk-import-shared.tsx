"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Circle, Download, Loader2, Upload, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BulkFormat, RowStatus } from "@/lib/bulk-import";

export function FormatToggle({
  format,
  onChange,
}: {
  format: BulkFormat;
  onChange: (f: BulkFormat) => void;
}) {
  return (
    <div className="flex rounded border border-border text-xs">
      <button
        type="button"
        onClick={() => onChange("csv")}
        className={cn(
          "px-3 py-1.5 transition-colors",
          format === "csv" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
        )}
      >
        CSV
      </button>
      <button
        type="button"
        onClick={() => onChange("json")}
        className={cn(
          "px-3 py-1.5 transition-colors",
          format === "json" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground",
        )}
      >
        JSON
      </button>
    </div>
  );
}

export function FileOrPasteInput({
  format,
  onText,
  accept,
}: {
  format: BulkFormat;
  onText: (text: string) => void;
  accept: string;
}) {
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = (e.target?.result as string) ?? "";
      setText(content);
      onText(content);
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-3.5 w-3.5" />
          Încarcă fișier
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <span className="text-xs text-muted-foreground">
          sau lipește {format === "csv" ? "CSV" : "JSON"} mai jos
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onText(e.target.value);
        }}
        rows={8}
        placeholder={
          format === "csv"
            ? "slug,title,...\nprima-problema,Prima problemă,..."
            : '[\n  { "slug": "prima-problema", "title": "Prima problemă", ... }\n]'
        }
        className="w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  );
}

export function TemplateDownloadButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button type="button" variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={onClick}>
      <Download className="h-3 w-3" />
      {label}
    </Button>
  );
}

const STATUS_ICON: Record<RowStatus, React.ReactNode> = {
  pending: <Circle className="h-3.5 w-3.5 text-muted-foreground" />,
  creating: <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-success" />,
  error: <XCircle className="h-3.5 w-3.5 text-destructive" />,
};

export function RowStatusIcon({ status }: { status: RowStatus }) {
  return STATUS_ICON[status];
}

export function ImportSummary({
  total,
  valid,
  done,
  failed,
}: {
  total: number;
  valid: number;
  done: number;
  failed: number;
}) {
  return (
    <p className="text-xs text-muted-foreground">
      {total} rânduri · {valid} valide
      {(done > 0 || failed > 0) && (
        <>
          {" · "}
          <span className="text-success">{done} create</span>
          {failed > 0 && (
            <>
              {" · "}
              <span className="text-destructive">{failed} eșuate</span>
            </>
          )}
        </>
      )}
    </p>
  );
}
