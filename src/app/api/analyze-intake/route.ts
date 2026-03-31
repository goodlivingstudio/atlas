import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 30;

// TEMP: OpenAI while Anthropic org is being restored.

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are Atlas — a personal strategy intelligence engine for a single operator: Jeremy Grant.

A file or document has been dropped into the Loading Dock. Your job is to analyze it and extract everything needed to start an engagement — structured for Atlas, not just summarized.

ANALYZE:
1. What type of document is this? (RFP, client brief, research report, competitive analysis, strategy deck, article, notes, transcript, etc.)
2. Who is the client or company? What's the engagement context?
3. What is the core problem or opportunity being addressed?
4. What competitors or alternatives are mentioned or implied?
5. What are the strategic tensions — the things that are unresolved, contradictory, or worth investigating?
6. What should happen next?

RETURN EXACTLY this JSON structure — no prose, no markdown, just JSON:

{
  "doc_type": "short descriptor of what this document is",
  "name": "suggested engagement name (specific, not generic)",
  "company": "client or company name, or null if not clear",
  "url": "primary URL if found in the document, or null",
  "brief": "2-3 sentence synthesis of what this engagement is about. Use the operator's language. State the problem, not just the subject.",
  "notes": "Strategic tensions, open questions, things that feel off. 3-5 observations, each 1-2 sentences. Start each with a dash.",
  "competitive_set": ["Competitor A", "Competitor B"],
  "signals": [
    { "label": "SHORT LABEL", "body": "One sentence observation." },
    { "label": "SHORT LABEL", "body": "One sentence observation." },
    { "label": "SHORT LABEL", "body": "One sentence observation." }
  ],
  "next_steps": [
    "Specific next action — what Atlas or the operator should do first.",
    "Second action.",
    "Third action."
  ]
}

VOICE: Analytical. Direct. No filler. Write the brief as if you're briefing a senior strategist who has 30 seconds. Signals should name what's actually interesting or concerning, not what's obvious.`;

export interface IntakeAnalysis {
  doc_type: string;
  name: string;
  company: string | null;
  url: string | null;
  brief: string;
  notes: string;
  competitive_set: string[];
  signals: Array<{ label: string; body: string }>;
  next_steps: string[];
}

export async function POST(request: NextRequest) {
  let body: { text?: string; filename?: string; type?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, filename = "document", type = "txt" } = body;

  if (!text?.trim()) {
    return NextResponse.json({ error: "No text to analyze" }, { status: 400 });
  }

  // Truncate to ~6000 words to stay within context limits while preserving structure
  const truncated = text.slice(0, 24000);
  const wasTruncated = text.length > 24000;

  const userContent = [
    `Filename: ${filename}`,
    `File type: ${type}`,
    wasTruncated ? `[Document truncated — analyzing first ~6000 words of ${Math.round(text.length / 4)} total]` : "",
    "",
    "DOCUMENT CONTENT:",
    truncated,
  ].filter(Boolean).join("\n");

  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      temperature: 0.3,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userContent },
      ],
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<IntakeAnalysis>;

    // Validate and fill defaults
    const analysis: IntakeAnalysis = {
      doc_type:        parsed.doc_type        || "document",
      name:            parsed.name            || filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
      company:         parsed.company         || null,
      url:             parsed.url             || null,
      brief:           parsed.brief           || "",
      notes:           parsed.notes           || "",
      competitive_set: Array.isArray(parsed.competitive_set) ? parsed.competitive_set : [],
      signals:         Array.isArray(parsed.signals) ? parsed.signals.slice(0, 3) : [],
      next_steps:      Array.isArray(parsed.next_steps) ? parsed.next_steps.slice(0, 4) : [],
    };

    return NextResponse.json(analysis);
  } catch (err) {
    console.error("[analyze-intake]", err);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}
