import Anthropic from "@anthropic-ai/sdk";
import { VoyageAIClient } from "voyageai";
import { getServiceClient } from "./supabase";
import { generateEmbedding } from "./embeddings";
import type { AtlasMode, KnowledgeLayer, RetrievalResult, QueryResponse } from "./types";

// ─── Clients ──────────────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
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
};

// ─── Pinned Core ──────────────────────────────────────────────────────────────
// Core doctrine and protocol are always included in every context window.
// They are the frame through which everything else is interpreted.
// They do NOT compete for retrieval slots — they are prepended unconditionally.

async function fetchPinnedCore(): Promise<RetrievalResult[]> {
  const supabase = getServiceClient();

  const { data: docs } = await supabase
    .from("documents")
    .select("id, title, layer, source_path, content, metadata, created_at, updated_at")
    .eq("layer", "core")
    .order("created_at", { ascending: true });

  if (!docs?.length) return [];

  const docIds = docs.map((d) => d.id);
  const { data: chunks } = await supabase
    .from("document_chunks")
    .select("id, document_id, chunk_index, content, token_count, metadata, created_at")
    .in("document_id", docIds)
    .order("chunk_index", { ascending: true });

  if (!chunks?.length) return [];

  const docMap = new Map(docs.map((d) => [d.id, d]));

  return chunks.map((chunk) => ({
    chunk: { ...chunk, embedding: [] },
    document: docMap.get(chunk.document_id)!,
    similarity: 1.0, // pinned — treated as maximally relevant
  }));
}

// ─── Hybrid Retrieval ─────────────────────────────────────────────────────────

export async function retrieveChunks(
  query: string,
  options: { layer?: KnowledgeLayer; topK?: number } = {}
): Promise<RetrievalResult[]> {
  const { layer, topK = 5 } = options;
  const supabase = getServiceClient();

  const queryEmbedding = await generateEmbedding(query);

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
  options: { mode?: AtlasMode; layer?: KnowledgeLayer; topK?: number } = {}
): Promise<QueryResponse> {
  const { mode = "DIAGNOSIS", layer, topK = 5 } = options;

  // 1. Retrieve broadly (20 candidates for reranker)
  const [pinnedCore, candidates] = await Promise.all([
    fetchPinnedCore(),
    retrieveChunks(query, { layer, topK: 20 }),
  ]);

  // 2. Filter out core chunks from candidates (already pinned, avoid duplication)
  const pinnedIds = new Set(pinnedCore.map((r) => r.chunk.id));
  const filteredCandidates = candidates.filter((r) => !pinnedIds.has(r.chunk.id));

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

  // 6. Synthesize with Claude
  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1500,
    system: SYSTEM_PROMPTS[mode],
    messages: [
      {
        role: "user",
        content: `Knowledge base context:\n\n${context}\n\n---\n\nQuery: ${query}`,
      },
    ],
  });

  const answer = message.content[0].type === "text" ? message.content[0].text : "";

  return {
    query,
    results: allResults,
    answer,
    sources: allResults.map((r) => ({
      document_title: r.document.title,
      layer: r.document.layer,
      chunk_index: r.chunk.chunk_index,
      similarity: r.similarity,
    })),
  };
}
