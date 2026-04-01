// TEMP: Using OpenAI while Anthropic org is being restored.
// To switch back: replace OpenAI client + messages.create call with Anthropic equivalents.
import OpenAI from "openai";
import { VoyageAIClient } from "voyageai";
import { getServiceClient } from "./supabase";
import { generateEmbedding } from "./embeddings";
import type { AtlasMode, KnowledgeLayer, RetrievalResult, QueryResponse } from "./types";

// ─── Clients ──────────────────────────────────────────────────────────────────

let _openai: OpenAI | null = null;
function getOpenAI() {
  if (!_openai) _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _openai;
}

let _voyage: VoyageAIClient | null = null;
function getVoyage() {
  if (!_voyage) _voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  return _voyage;
}

// ─── System Prompts ───────────────────────────────────────────────────────────

const SHARED_PRINCIPLES = `
INFORMATION QUALITY — label all claims:
- Established fact: verified, sourced, materially reliable
- Informed inference: reasonable conclusion from partial but credible data
- Working assumption: useful framing not yet tested
- Speculation: hypothesis without supporting evidence, offered for exploration

VOICE — The Wise Counselor:
- Composed, direct, unhurried. No urgency theater. No alarmist framing.
- Name tradeoffs explicitly. Distinguish signal from noise.
- No filler, flourish, or AI cadence. Never say "Certainly", "Great question", or "As an AI".
- Do not summarize what you just said at the end of your response.
- Adjust register: analytical when argument is required, exploratory when the problem is still forming.
- Sycophancy is a system failure. Challenge weak reasoning. Resist confirming what the operator already believes.

SOURCING — cite every factual claim as [Source N] using the numbered sources provided.
If context is insufficient: name the gap in one sentence, state what's adjacent, recommend what would fill it.`;

const SYSTEM_PROMPTS: Record<AtlasMode, string> = {
  DIAGNOSIS: `You are Atlas — a personal strategy super intelligence engine. Single operator: Jeremy Grant.

MODE: DIAGNOSIS
The operator is reading the situation without agenda. Surface evidence, map forces, name unknowns, ask clarifying questions. Withhold judgment until invited. The goal is an accurate picture of what is true before any position is formed.

Diagnosis that avoids conclusions is a failure. Name what the evidence shows — including what is inconvenient. Truth before opinion.
${SHARED_PRINCIPLES}
Answer using ONLY the provided knowledge base context.`,

  PRESCRIPTION: `You are Atlas — a personal strategy super intelligence engine. Single operator: Jeremy Grant.

MODE: PRESCRIPTION
The operator has a direction and is building the argument. Sharpen the position, surface supporting evidence, name counterarguments that need addressing, help construct something defensible.

Prescription that outruns its evidence is a failure. Advocate with rigor — find the strongest version of the operator's position, then name what could break it. The plan and the justification are inseparable.
${SHARED_PRINCIPLES}
Answer using ONLY the provided knowledge base context.`,

  GENERATE: `You are Atlas — a personal strategy super intelligence engine. Single operator: Jeremy Grant.

MODE: GENERATE
The operator wants to produce a structured, usable deliverable — not an answer. Write a polished document based on the knowledge base context and the request.

DOCUMENT STANDARDS:
- Use ## headers to organize sections
- Be specific and direct — this is a working document
- Cite every factual claim as [Source N] using the numbered sources provided
- Open with a one-sentence framing of what this document is and why it exists
- Close with a "Key Assumptions" section noting what is established fact vs inference
- Length: as long as the document needs to be, no more

FORMATS this mode handles well: competitive brief, positioning memo, strategy narrative, engagement summary, hypothesis document, talking points, SWOT analysis, stakeholder brief.

${SHARED_PRINCIPLES}
Write using ONLY the provided knowledge base context.`,
};

// ─── Pinned Core ──────────────────────────────────────────────────────────────
// Core doctrine and protocol are always represented in every context window.
// Rather than dumping all core chunks, we pick the TOP_PINNED_CORE most
// semantically relevant core chunks for the query — ensuring the operating
// framework is always present without drowning the context window.

const TOP_PINNED_CORE = 4;

async function fetchPinnedCore(queryEmbedding: number[]): Promise<RetrievalResult[]> {
  const supabase = getServiceClient();

  // Use match_chunks filtered to core layer — gets the most relevant core chunks
  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: TOP_PINNED_CORE,
    filter_layer: "core",
  });

  if (error || !data?.length) return [];

  return buildResults(data, supabase);
}

// ─── Hybrid Retrieval ─────────────────────────────────────────────────────────

export async function retrieveChunks(
  query: string,
  options: { layer?: KnowledgeLayer; topK?: number; precomputedEmbedding?: number[] } = {}
): Promise<RetrievalResult[]> {
  const { layer, topK = 5, precomputedEmbedding } = options;
  const supabase = getServiceClient();

  const queryEmbedding = precomputedEmbedding ?? await generateEmbedding(query);

  // Try hybrid search first; fall back to semantic-only if FTS column not yet populated
  const { data, error } = await supabase.rpc("hybrid_search", {
    query_text: query,
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    filter_layer: layer || null,
    rrf_k: 60,
  });

  if (error) {
    // Fallback to original match_chunks if hybrid not available
    const { data: fallback, error: fallbackError } = await supabase.rpc("match_chunks", {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: topK,
      filter_layer: layer || null,
    });
    if (fallbackError) throw new Error(`Retrieval failed: ${fallbackError.message}`);
    return buildResults(fallback || [], supabase);
  }

  return buildResults(data || [], supabase);
}

type RawChunkRow = {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: Record<string, unknown>;
  similarity: number;
};

async function buildResults(
  rows: RawChunkRow[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
): Promise<RetrievalResult[]> {
  if (!rows.length) return [];

  const documentIds = [...new Set(rows.map((r) => r.document_id))];
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .in("id", documentIds);

  const docMap = new Map<string, unknown>(documents?.map((d: { id: string }) => [d.id, d]) || []);

  return rows.map((row) => ({
    chunk: {
      id: row.id,
      document_id: row.document_id,
      chunk_index: row.chunk_index,
      content: row.content,
      token_count: row.token_count,
      metadata: row.metadata,
      embedding: [],
      created_at: "",
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    document: docMap.get(row.document_id) as any,
    similarity: row.similarity,
  }));
}

// ─── Reranker ─────────────────────────────────────────────────────────────────
// Voyage rerank-2 re-scores retrieved candidates using a cross-encoder model
// that evaluates the query and each chunk together (more accurate than embedding similarity).
// Flow: retrieve 20 → rerank → take top 5.

async function rerank(
  query: string,
  results: RetrievalResult[],
  topK: number
): Promise<RetrievalResult[]> {
  if (!results.length) return results;

  try {
    const response = await getVoyage().rerank({
      model: "rerank-2",
      query,
      documents: results.map((r) => r.chunk.content),
      topK,
    });

    return (response.data || []).map((item) => {
      const idx = item.index ?? 0;
      return {
        ...results[idx],
        similarity: item.relevanceScore ?? results[idx].similarity,
      };
    });
  } catch {
    // If reranker fails (e.g. quota), return original order truncated
    return results.slice(0, topK);
  }
}

// ─── Query ────────────────────────────────────────────────────────────────────

export async function queryKnowledgeBase(
  query: string,
  options: {
    mode?: AtlasMode;
    layer?: KnowledgeLayer;
    topK?: number;
    engagementId?: string;
    conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
  } = {}
): Promise<QueryResponse> {
  const { mode = "DIAGNOSIS", layer, topK = 5, engagementId, conversationHistory } = options;

  // 1. Embed query once — reused for pinned core + hybrid retrieval
  const queryEmbedding = await generateEmbedding(query);

  // 1b. Fetch engagement context if engagementId provided
  let engagementContext: string | null = null;
  if (engagementId) {
    try {
      const supabase = getServiceClient();
      const { data: eng } = await supabase
        .from("engagements")
        .select("brief, notes")
        .eq("id", engagementId)
        .single();
      if (eng) {
        engagementContext = `ENGAGEMENT CONTEXT:\n${eng.brief || ""}\n\nNotes: ${eng.notes || ""}`;
      }
    } catch {
      // Ignore — proceed without engagement context
    }
  }

  // 2. Pinned core + broad candidates in parallel
  const [pinnedCore, candidates] = await Promise.all([
    fetchPinnedCore(queryEmbedding),
    retrieveChunks(query, { layer, topK: 20, precomputedEmbedding: queryEmbedding }),
  ]);

  // 2. Filter out core chunks from candidates (already pinned, avoid duplication)
  const pinnedCoreIds = new Set(pinnedCore.map((r) => r.chunk.id));
  const filteredCandidates = candidates.filter((r) => !pinnedCoreIds.has(r.chunk.id));

  // 3. Rerank candidates, take top K
  const reranked = await rerank(query, filteredCandidates, topK);

  // 4. Assemble final context: pinned core first, then reranked results
  const allResults = [...pinnedCore, ...reranked];

  // 5. Build context string with numbered sources
  const context = allResults
    .map((r, i) => {
      const heading = r.chunk.metadata?.section_heading
        ? ` § ${r.chunk.metadata.section_heading}`
        : "";
      const confidence = r.chunk.metadata?.confidence_tier
        ? ` [${String(r.chunk.metadata.confidence_tier).replace(/_/g, " ")}]`
        : "";
      return `[Source ${i + 1}: "${r.document.title}" · ${r.document.layer}${heading}${confidence}]\n${r.chunk.content}`;
    })
    .join("\n\n---\n\n");

  // 6. Build user message — prepend engagement context if available
  const userMessage = engagementContext
    ? `${engagementContext}\n\n---\n\nQuery: ${query}`
    : `Knowledge base context:\n\n${context}\n\n---\n\nQuery: ${query}`;

  // Build messages array with optional conversation history (last 6 turns)
  const historyMessages: Array<{ role: "user" | "assistant"; content: string }> =
    conversationHistory ? conversationHistory.slice(-6) : [];

  // 6. Synthesize — temp: OpenAI gpt-4o (swap back to Claude when Anthropic key restored)
  const message = await getOpenAI().chat.completions.create({
    model: "gpt-4o",
    max_tokens: 1500,
    messages: [
      { role: "system", content: SYSTEM_PROMPTS[mode] },
      // If no engagement context, prepend the KB context as a system-adjacent user message
      ...(engagementContext
        ? [{ role: "user" as const, content: `Knowledge base context:\n\n${context}` },
           { role: "assistant" as const, content: "Understood. I have the knowledge base context and engagement context." }]
        : []),
      ...historyMessages,
      { role: "user", content: userMessage },
    ],
  });

  const answer = message.choices[0].message.content ?? "";

  const pinnedIds = new Set(pinnedCore.map((r) => r.chunk.id));

  return {
    query,
    results: allResults,
    answer,
    sources: allResults.map((r) => ({
      document_title: r.document.title,
      layer: r.document.layer,
      chunk_index: r.chunk.chunk_index,
      section_heading: r.chunk.metadata?.section_heading as string | undefined,
      similarity: r.similarity,
      pinned: pinnedIds.has(r.chunk.id),
      source_path: r.document.source_path,
    })),
  };
}
