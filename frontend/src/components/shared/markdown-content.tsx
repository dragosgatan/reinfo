"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import { Check, Copy } from "lucide-react";
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";
import { cn } from "@/lib/utils";
import { getNodeText, normalizeMarkdown, sanitizeUrl } from "@/lib/markdown-utils";

export interface CodeBlockRenderArgs {
  language: string | null;
  code: string;
}

/** Return a ReactNode to fully replace a fenced code block's default rendering, or
 * undefined to fall through to the default (highlighted, with a copy button). */
export type CodeBlockRenderer = (args: CodeBlockRenderArgs) => ReactNode | undefined;

interface MarkdownContentProps {
  markdown: string;
  className?: string;
  /** "compact" is for tight spaces like chat bubbles - smaller margins, no h1/h2. */
  variant?: "default" | "compact";
  renderCodeBlock?: CodeBlockRenderer;
  /** Set false for untrusted user content (e.g. bios) to render images as their alt
   * text instead of loading them - avoids third-party tracking pixels on public pages. */
  allowImages?: boolean;
}

export function MarkdownContent({
  markdown,
  className,
  variant = "default",
  renderCodeBlock,
  allowImages = true,
}: MarkdownContentProps) {
  const compact = variant === "compact";

  return (
    <div className={cn(compact ? "text-sm" : "text-sm leading-7", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, [rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        urlTransform={sanitizeUrl}
        components={buildComponents(compact, renderCodeBlock, allowImages)}
      >
        {normalizeMarkdown(markdown)}
      </ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => {});
      }}
      className="absolute right-2 top-2 rounded border border-border bg-background/80 p-1 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
      aria-label="Copiază codul"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function buildComponents(
  compact: boolean,
  renderCodeBlock?: CodeBlockRenderer,
  allowImages = true,
) {
  const gap = compact ? "mb-2" : "mb-4";

  return {
    p: ({ children }: { children?: ReactNode }) => (
      <p className={cn(gap, "leading-relaxed last:mb-0")}>{children}</p>
    ),
    img: allowImages
      ? ({ src, alt }: ComponentProps<"img">) => (
          // Arbitrary external markdown image URLs can't go through next/image without a domain allowlist.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} className={cn(gap, "max-w-full rounded border border-border")} />
        )
      : ({ alt }: ComponentProps<"img">) =>
          alt ? <span className="italic text-muted-foreground">[{alt}]</span> : null,
    h1: ({ children }: { children?: ReactNode }) =>
      compact ? (
        <p className={cn(gap, "font-semibold")}>{children}</p>
      ) : (
        <h1 className="mb-3 mt-6 text-lg font-bold first:mt-0">{children}</h1>
      ),
    h2: ({ children }: { children?: ReactNode }) =>
      compact ? (
        <p className={cn(gap, "font-semibold")}>{children}</p>
      ) : (
        <h2 className="mb-2 mt-5 text-base font-semibold first:mt-0">{children}</h2>
      ),
    h3: ({ children }: { children?: ReactNode }) => (
      <h3
        className={cn(
          "mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground first:mt-0",
          compact ? "mt-3" : "mt-4",
        )}
      >
        {children}
      </h3>
    ),
    ul: ({ children }: { children?: ReactNode }) => (
      <ul className={cn(gap, "list-disc space-y-1 pl-5")}>{children}</ul>
    ),
    ol: ({ children }: { children?: ReactNode }) => (
      <ol className={cn(gap, "list-decimal space-y-1 pl-5")}>{children}</ol>
    ),
    li: ({ children }: { children?: ReactNode }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }: { children?: ReactNode }) => (
      <strong className="font-semibold">{children}</strong>
    ),
    em: ({ children }: { children?: ReactNode }) => <em className="italic">{children}</em>,
    del: ({ children }: { children?: ReactNode }) => <del className="opacity-70">{children}</del>,
    blockquote: ({ children }: { children?: ReactNode }) => (
      <blockquote className={cn(gap, "border-l-2 border-border pl-4 italic text-muted-foreground")}>
        {children}
      </blockquote>
    ),
    table: ({ children }: { children?: ReactNode }) => (
      <div className={cn(gap, "overflow-x-auto")}>
        <table className="min-w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children }: { children?: ReactNode }) => (
      <th className="border border-border bg-muted px-3 py-1.5 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }: { children?: ReactNode }) => (
      <td className="border border-border px-3 py-1.5">{children}</td>
    ),
    a: ({ href, children }: ComponentProps<"a">) => (
      <a
        href={href}
        className="text-primary underline underline-offset-2 hover:text-primary/80"
        target="_blank"
        rel="noopener noreferrer nofollow"
      >
        {children}
      </a>
    ),
    hr: () => <hr className="my-6 border-border" />,
    code: ({ className, children }: ComponentProps<"code">) => {
      const isBlock = Boolean(className);
      if (isBlock) {
        return <code className={cn("text-xs", className)}>{children}</code>;
      }
      return (
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
      );
    },
    pre: ({ children }: { children?: ReactNode }) => {
      const codeElement = Array.isArray(children) ? children[0] : children;
      const codeClassName =
        codeElement && typeof codeElement === "object" && "props" in codeElement
          ? ((codeElement as { props?: { className?: string } }).props?.className ?? "")
          : "";
      const language = /language-(\w+)/.exec(codeClassName)?.[1] ?? null;
      const text = getNodeText(children).replace(/\n$/, "");

      const custom = renderCodeBlock?.({ language, code: text });
      if (custom !== undefined) return <>{custom}</>;

      return (
        <div className={cn(gap, "group relative")}>
          <pre className="overflow-x-auto rounded border border-border bg-muted p-4 font-mono text-xs leading-relaxed">
            {children}
          </pre>
          <CopyButton text={text} />
        </div>
      );
    },
  };
}
