import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const revalidate = 300; // re-fetch every 5 min

export interface TickerItem {
  id: string;
  cat: string;
  text: string;
  url: string | null;
  source: "dynamic" | "curated";
}

// ─── Curated baseline ─────────────────────────────────────────────────────────
// Updated manually as the strategic landscape shifts.
// Categories: STRATEGY · BRAND · AI · MARKET · THINKING

const CURATED: Omit<TickerItem, "id" | "source">[] = [
  { cat: "STRATEGY",  text: "Roger Rumelt: 'Bad strategy is the active avoidance of calling out what the real problem is. Good strategy names the challenge.'", url: "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights/the-perils-of-bad-strategy" },
  { cat: "BRAND",     text: "Byron Sharp: Mental availability — the probability that a buyer will think of a brand in buying situations — is the core brand-building objective", url: "https://marketingscience.info/" },
  { cat: "AI",        text: "Agentic AI shifts the bottleneck from data retrieval to judgment quality. The strategist's job is not diminished — it is clarified.", url: "https://www.anthropic.com/news" },
  { cat: "STRATEGY",  text: "McKinsey: Companies that invest in strategic clarity during uncertainty outperform peers by 3x over the following five years", url: "https://www.mckinsey.com/capabilities/strategy-and-corporate-finance/our-insights" },
  { cat: "BRAND",     text: "Lafley & Martin: Strategy is an integrated set of choices. 'Where to play' and 'how to win' are inseparable — choosing one without the other is not strategy", url: "https://rogerlmartin.com/" },
  { cat: "THINKING",  text: "Kahneman: System 1 thinking drives the majority of purchase decisions. Strategy that requires deliberate reasoning from buyers will underperform.", url: "https://hbr.org/2011/10/the-big-idea-before-you-make-that-big-decision" },
  { cat: "MARKET",    text: "Global strategy consulting market: AI tooling compresses junior-level analysis. The premium on senior judgment and client trust is widening, not narrowing.", url: "https://www.ibisworld.com/" },
  { cat: "BRAND",     text: "Ehrenberg-Bass: Distinctive brand assets compound over time. Inconsistency destroys accumulated mental availability — the most expensive brand mistake.", url: "https://marketingscience.info/" },
  { cat: "AI",        text: "RAG-based knowledge systems are replacing internal wikis. The organisations that structure their institutional knowledge first will have a compounding advantage.", url: "https://hbr.org/topic/subject/ai-and-machine-learning" },
  { cat: "STRATEGY",  text: "HBR: Jobs-to-be-done predicts switching behavior better than any demographic or attitudinal segmentation — reframe your competition accordingly", url: "https://hbr.org/2016/09/know-your-customers-jobs-to-be-done" },
  { cat: "BRAND",     text: "April Dunford: Positioning is not taglines. It is the strategic context — competitive alternatives, unique attributes, value for customers — from which everything downstream follows.", url: "https://aprildunford.com/" },
  { cat: "THINKING",  text: "The Innovator's Dilemma still explains most large-company failures. The disruption vector is almost never the one they are watching.", url: "https://hbr.org/1995/01/disruptive-technologies-catching-the-wave" },
  { cat: "MARKET",    text: "B2B buyers complete 70% of their research before engaging a vendor. Brand trust and thought leadership shape the shortlist before the conversation begins.", url: "https://www.gartner.com/" },
  { cat: "AI",        text: "Cursor, v0, and Claude's extended thinking are compressing the design-to-decision cycle. The judgment gap is widening between those who know how to brief AI and those who don't.", url: "https://cursor.com/" },
  { cat: "BRAND",     text: "The challenger brand playbook: identify a sacred convention in the category, then break it with purpose. Meaning beats awareness when you can't outspend the leader.", url: "https://www.eatbigfish.com/" },
  { cat: "STRATEGY",  text: "Blue Ocean Strategy: 'Competing in overcrowded industries is no way to sustain high performance. Value innovation creates uncontested market space.'", url: "https://www.blueoceanstrategy.com/" },
  { cat: "THINKING",  text: "Peter Thiel: 'What important truth do very few people agree with you on?' The divergence between your answer and consensus is the only place where monopoly value is created.", url: "https://zerotoonebook.com/" },
  { cat: "MARKET",    text: "Category design is compounding as a strategic discipline. Companies that define a category they can lead consistently outperform those that compete for existing category share.", url: "https://www.categorypiratescom/" },
  { cat: "AI",        text: "NotebookLM, Perplexity, and Harvey demonstrate the model: institutional knowledge + LLM retrieval = first-draft analyst. The strategist's moat is synthesis and judgment.", url: "https://notebooklm.google.com/" },
  { cat: "STRATEGY",  text: "Richard Rumelt: A kernel of good strategy contains a diagnosis, a guiding policy, and coherent actions. Most corporate strategy contains none of the three.", url: "https://hbr.org/2007/09/the-perils-of-bad-strategy" },
  { cat: "BRAND",     text: "Mental availability is built through reach, consistency, and emotional intensity — not frequency or media spend. Sharp's research still contradicts most media plans.", url: "https://marketingscience.info/" },
  { cat: "THINKING",  text: "The innovator's advantage is not technology — it is the willingness to cannibalize your own revenue before a competitor does it for you.", url: "https://hbr.org/topic/subject/innovation" },
  { cat: "MARKET",    text: "Private equity is accelerating brand consolidation in healthcare services. The design and patient experience gap between leaders and laggards is becoming the differentiating variable.", url: "https://www.mckinsey.com/industries/healthcare/our-insights" },
  { cat: "AI",        text: "Structured prompting and retrieval-augmented generation are becoming core strategy consulting competencies. The firms building these workflows now will have a 3–5 year head start.", url: "https://www.anthropic.com/claude" },
  { cat: "STRATEGY",  text: "Wardley Mapping: strategy without situational awareness is navigation without a map. Understanding where components sit on the evolution curve changes every resource allocation decision.", url: "https://learnwardleymapping.com/" },
];

export async function GET() {
  const items: TickerItem[] = [];

  // ── Pull dynamic items from market + live layers ────────────────────────────
  try {
    const supabase = getServiceClient();
    const { data } = await supabase
      .from("documents")
      .select("id, title, layer, metadata")
      .in("layer", ["market", "live"])
      .order("created_at", { ascending: false })
      .limit(20);

    if (data?.length) {
      for (const doc of data) {
        const meta = doc.metadata as Record<string, unknown>;
        const url = (meta?.url as string) || (meta?.source_url as string) || null;
        const cat = doc.layer === "live" ? "SIGNAL" : "MARKET";
        items.push({
          id: doc.id,
          cat,
          text: doc.title,
          url,
          source: "dynamic",
        });
      }
    }
  } catch {
    // Non-blocking — fall through to curated
  }

  // ── Append curated baseline ─────────────────────────────────────────────────
  CURATED.forEach((item, i) => {
    items.push({ ...item, id: `curated-${i}`, source: "curated" });
  });

  return NextResponse.json(items);
}
