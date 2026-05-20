import { NextRequest, NextResponse } from "next/server";

const MODEL = "deepseek/deepseek-v4-flash";

const LANG_NAMES: Record<string, string> = {
  ro: "Romanian",
  en: "English",
  hu: "Hungarian",
};

type OpenRouterResponse = {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Translation not configured" }, { status: 503 });
  }

  const body = await req.json() as { text: string; sourceLang: string; targetLangs: string[] };
  const { text, sourceLang, targetLangs } = body;

  if (!text || !sourceLang || !targetLangs?.length) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const results: Record<string, string> = {};

  for (const lang of targetLangs) {
    const langName = LANG_NAMES[lang] ?? lang;

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://reinfo.ro",
          "X-Title": "ReInfo",
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: "system",
              content: `You are a translator for a competitive programming platform. Translate the following Markdown document to ${langName}. Rules you must follow without exception:\n1. Output the COMPLETE document — never truncate, summarize, or omit any part.\n2. Preserve ALL Markdown structure exactly: headings, bullet lists, numbered lists, bold/italic, tables, blockquotes, horizontal rules.\n3. Preserve ALL code blocks verbatim (content between triple backticks or indented). Do not translate code, variable names, or identifiers inside code blocks.\n4. Preserve ALL LaTeX math exactly as written (inline $...$ and display $$...$$). Do not translate or reformat math.\n5. Preserve ALL HTML comments (e.g. <!-- quiz:q1 -->) verbatim.\n6. Preserve ALL URLs, slugs, and file paths verbatim.\n7. Only translate the natural-language prose — headings, paragraph text, list item text.\n8. Output only the translated Markdown, nothing else. No explanations, no preamble.`,
            },
            { role: "user", content: text },
          ],
        }),
      });

      const data = await res.json() as OpenRouterResponse;

      if (!res.ok || data.error) {
        const msg = data.error?.message ?? `HTTP ${res.status}`;
        console.error(`[translate] ${MODEL}:`, msg);
        return NextResponse.json({ error: msg }, { status: 502 });
      }

      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
      }

      results[lang] = content;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "fetch failed";
      console.error(`[translate] ${MODEL}:`, msg);
      return NextResponse.json({ error: msg }, { status: 502 });
    }
  }

  return NextResponse.json({ results, model: MODEL });
}
