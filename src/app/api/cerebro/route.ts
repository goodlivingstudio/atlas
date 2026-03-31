import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 30;

// ─── Client ───────────────────────────────────────────────────────────────────
// TEMP: Using OpenAI while Anthropic org is being restored.

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM = `You are Atlas — a strategy intelligence engine for a single operator: Jeremy Grant.

Scan the provided context (knowledge base documents and active engagements) and surface exactly 3 strategic intelligence signals.

Each signal should be one of:
- A pattern emerging across the knowledge base or active engagements
- A strategic gap, tension, or asymmetry worth acting on
- A market or competitive signal relevant to current work
- A positioning or framing observation that changes how a problem should be approached

SIGNAL QUALITY:
- Specific, not generic. Point to what you actually observed in the context.
- Actionable or directional. The operator should know what to do with it.
- Doctrine-aligned. Diagnosis over prescription unless the pattern is clear.
- No filler. No "it's important to note." No "this suggests that."

VOICE: Composed. Direct. Analytical. The Wise Counselor.

Return ONLY valid JSON in this exact format:
{
  "signals": [
    { "label": "SIGNAL LABEL IN CAPS", "body": "2-3 sentence observation." },
    { "label": "SIGNAL LABEL IN CAPS", "body": "2-3 sentence observation." },
    { "label": "SIGNAL LABEL IN CAPS", "body": "2-3 sentence observation." }
  ]
}`;

export async function POST() {
  try {
    const supabase = getServiceClient();

    // ── Fetch recent documents ───────────────────────────────────────────────
    const { data: docs } = await supabase
      .from("documents")
      .select("title, layer, metadata, content")
      .order("created_at", { ascending: false })
      .limit(12);

    // ── Fetch active engagements ─────────────────────────────────────────────
    const { data: engagements } = await supabase
      .from("engagements")
      .select("name, company, brief, notes, competitive_set, status")
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(8);

    if (!docs?.length && !engagements?.length) {
      return NextResponse.json({
        signals: [
          { label: "KNOWLEDGE BASE EMPTY", body: "No documents have been ingested yet. Start by adding your core doctrine and frameworks to the knowledge base." },
          { label: "NO ACTIVE ENGAGEMENTS", body: "Visit the Loading Dock to start an engagement. Atlas builds context from incomplete inputs — a name and brief is enough to begin." },
          { label: "SYSTEM READY", body: "Atlas is configured and awaiting material. The quality of intelligence is limited by the quality of what enters the knowledge base." },
        ],
      });
    }

    // ── Build context string ─────────────────────────────────────────────────
    const parts: string[] = [];

    if (docs?.length) {
      parts.push("KNOWLEDGE BASE DOCUMENTS:\n" + docs.map((d) => {
        const snippet = (d.content as string)?.slice(0, 300)?.replace(/\s+/g, " ") ?? "";
        return `[${d.layer.toUpperCase()}] "${d.title}"${snippet ? ` — ${snippet}` : ""}`;
      }).join("\n"));
    }

    if (engagements?.length) {
      parts.push("ACTIVE ENGAGEMENTS:\n" + engagements.map((e) => {
        const comp = e.competitive_set?.length ? ` vs. ${(e.competitive_set as string[]).join(", ")}` : "";
        return `${e.name}${e.company ? ` (${e.company})` : ""}${comp}\n  Brief: ${e.brief || "—"}\n  Notes: ${e.notes || "—"}`;
      }).join("\n\n"));
    }

    const context = parts.join("\n\n---\n\n");

    // ── Synthesize ───────────────────────────────────────────────────────────
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      max_tokens: 600,
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: context },
      ],
    });

    const raw = response.choices[0].message.content ?? "{}";
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed.signals) || parsed.signals.length === 0) {
      throw new Error("Invalid signal response");
    }

    return NextResponse.json({ signals: parsed.signals.slice(0, 3) });
  } catch (err) {
    console.error("[cerebro]", err);
    return NextResponse.json({ error: "Cerebro unavailable" }, { status: 500 });
  }
}
