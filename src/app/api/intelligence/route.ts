import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "@/lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IntelligenceCard {
  headline: string;
  body: string;
  source?: string;
  engagement?: string;
}

// ─── Anthropic singleton ─────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _anthropic;
}

// ─── GET /api/intelligence ────────────────────────────────────────────────────

export async function GET(): Promise<Response> {
  try {
    // 1. Fetch active engagements from Supabase
    let engagements: Array<{ id: string; name: string; company: string | null }> = [];
    try {
      const supabase = getServiceClient();
      const { data } = await supabase
        .from("engagements")
        .select("id, name, company")
        .eq("status", "active");
      engagements = data ?? [];
    } catch {
      // Supabase not configured — return gracefully
      return Response.json({ cards: [] });
    }

    if (engagements.length === 0) {
      return Response.json({ cards: [] });
    }

    // 2. Fetch news from DISPATCH_URL if configured
    const dispatchUrl = process.env.DISPATCH_URL;
    let newsItems: Array<{ title?: string; headline?: string; summary?: string; source?: string }> = [];
    if (dispatchUrl) {
      try {
        const res = await fetch(`${dispatchUrl}/api/news`, {
          next: { revalidate: 300 },
        });
        if (res.ok) {
          const data = await res.json();
          newsItems = Array.isArray(data) ? data : (data.items ?? data.articles ?? []);
        }
      } catch {
        // Dispatch unreachable — proceed without news
      }
    }

    if (newsItems.length === 0 && dispatchUrl) {
      // We have engagements but no news — nothing to synthesize
      return Response.json({ cards: [] });
    }

    // 3. Build synthesis prompt
    const engagementList = engagements
      .map((e) => `- ${e.name}${e.company ? ` (${e.company})` : ""}`)
      .join("\n");

    const newsList = newsItems.length > 0
      ? newsItems
          .slice(0, 15)
          .map((n, i) => {
            const headline = n.title ?? n.headline ?? "Untitled";
            const body = n.summary ? ` — ${n.summary.slice(0, 200)}` : "";
            const src = n.source ? ` [${n.source}]` : "";
            return `${i + 1}. ${headline}${body}${src}`;
          })
          .join("\n")
      : "No live news available.";

    const prompt = `You are a strategic intelligence analyst. Given recent news and a list of active client engagements, synthesize 3-4 brief intelligence cards that surface relevant connections, opportunities, or risks.

ACTIVE ENGAGEMENTS:
${engagementList}

RECENT NEWS:
${newsList}

Return a JSON object with this exact shape:
{
  "cards": [
    {
      "headline": "Short, direct insight headline (max 12 words)",
      "body": "1-2 sentence explanation of why this matters strategically (max 60 words)",
      "source": "News source or topic if relevant (optional)",
      "engagement": "Engagement name this most applies to (optional)"
    }
  ]
}

Rules:
- 3-4 cards only
- Each card must connect a news signal to at least one engagement context
- Headline: sharp, declarative, no filler
- Body: specific, strategic, no generic observations
- If news is unavailable, return {"cards": []}
- Return ONLY valid JSON, no markdown`;

    const completion = await getAnthropic().messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [
        { role: "user", content: prompt + "\n\nReturn ONLY valid JSON." },
      ],
    });

    const raw = completion.content[0]?.type === "text" ? completion.content[0].text : "{}";
    let parsed: { cards?: IntelligenceCard[] };
    try {
      parsed = JSON.parse(raw);
    } catch {
      return Response.json({ cards: [] });
    }

    const cards: IntelligenceCard[] = Array.isArray(parsed.cards) ? parsed.cards : [];

    return Response.json({ cards });
  } catch {
    return Response.json({ cards: [] });
  }
}
