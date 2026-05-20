import { NextRequest, NextResponse } from "next/server";

const MODEL = "deepseek/deepseek-v4-flash";

type Message = { role: string; content: string };

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI not configured" }, { status: 503 });
  }

  const body = (await req.json()) as {
    messages: Message[];
    lessonTitle: string;
    lessonContent: string;
  };

  const { messages, lessonTitle, lessonContent } = body;

  if (!messages?.length || !lessonTitle || !lessonContent) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const systemPrompt = `You are a helpful programming tutor assistant for ReInfo, a Romanian competitive programming platform. You are helping a student understand the following lesson.

Title: ${lessonTitle}

Lesson content (Markdown):
${lessonContent}

Answer questions about this lesson clearly and concisely. Explain concepts in a student-friendly way. If the student asks something unrelated to the lesson, gently redirect them back to the topic.`;

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://reinfo.ro",
      "X-Title": "ReInfo",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    console.error("[lesson-chat] upstream error:", res.status, text);
    return NextResponse.json({ error: "Model error" }, { status: 502 });
  }

  return new Response(res.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}
