import Anthropic from "@anthropic-ai/sdk";
import { getServiceClient } from "./supabase";
import { generateEmbedding } from "./embeddings";
import type { AtlasMode, KnowledgeLayer, RetrievalResult, QueryResponse } from "./types";

let _anthropic: Anthropic | null = null;
function getAnthropic() {
  if (!_anthropic) _anthropic = new Anthropic();
  return _anthropic;
}

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

export async function retrieveChunks(
  query: string,
  options: { layer?: KnowledgeLayer; topK?: number } = {}
): Promise<RetrievalResult[]> {
  const { layer, topK = 5 } = options;
  const supabase = getServiceClient();

  const queryEmbedding = await generateEmbedding(query);

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    filter_layer: layer || null,
  });

  if (error) {
    throw new Error(`Retrieval failed: ${error.message}`);
  }

  const documentIds = [...new Set(data.map((r: { document_id: string }) => r.document_id))];
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .in("id", documentIds);

  const docMap = new Map(documents?.map((d: { id: string }) => [d.id, d]) || []);

  return data.map((row: {
    id: string;
    document_id: string;
    chunk_index: number;
    content: string;
    token_count: number;
    metadata: Record<string, unknown>;
    similarity: number;
  }) => ({
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
    document: docMap.get(row.document_id),
    similarity: row.similarity,
  }));
}

export async function queryKnowledgeBase(
  query: string,
  options: { mode?: AtlasMode; layer?: KnowledgeLayer; topK?: number } = {}
): Promise<QueryResponse> {
  const { mode = "DIAGNOSIS", layer, topK } = options;
  const results = await retrieveChunks(query, { layer, topK });

  const context = results
    .map((r, i) =>
      `[Source ${i + 1}: "${r.document.title}" · ${r.document.layer} · chunk ${r.chunk.chunk_index}]\n${r.chunk.content}`
    )
    .join("\n\n---\n\n");

  const message = await getAnthropic().messages.create({
    model: "claude-sonnet-4-6-20250514",
    max_tokens: 1024,
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
    results,
    answer,
    sources: results.map((r) => ({
      document_title: r.document.title,
      layer: r.document.layer,
      chunk_index: r.chunk.chunk_index,
      similarity: r.similarity,
    })),
  };
}
