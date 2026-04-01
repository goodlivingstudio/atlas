export type KnowledgeLayer = "core" | "frameworks" | "clients" | "market" | "live";
export type Skin = "mineral" | "slate" | "forest";
export type AtlasMode = "DIAGNOSIS" | "PRESCRIPTION" | "GENERATE";

export type ConfidenceTier =
  | "established_fact"
  | "informed_inference"
  | "working_assumption"
  | "speculation";

export type TopicTag =
  | "atlas-doctrine"
  | "atlas-protocol"
  | "brand-strategy"
  | "product-strategy"
  | "competitive-intelligence"
  | "audience-research"
  | "positioning"
  | "innovation"
  | "behavioral-economics"
  | "challenger-brand"
  | "organizational-strategy"
  | "creative-strategy"
  | "data-analytics"
  | "jobs-to-be-done"
  | "mental-availability";

export interface Document {
  id: string;
  title: string;
  layer: KnowledgeLayer;
  source_path: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  embedding: number[];
  token_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  document: Document;
  similarity: number;
}

export interface QueryRequest {
  query: string;
  mode: AtlasMode;
  layer?: KnowledgeLayer;
  top_k?: number;
}

export interface QueryResponse {
  query: string;
  results: RetrievalResult[];
  answer: string;
  sources: Array<{
    document_title: string;
    layer: KnowledgeLayer;
    chunk_index: number;
    section_heading?: string;
    similarity: number;
    pinned: boolean;
    source_path?: string;
  }>;
}

export const LAYER_META: Record<KnowledgeLayer, { label: string; description: string; color: string }> = {
  core: {
    label: "Core Doctrine",
    description: "Atlas doctrine, agent operating protocol",
    color: "var(--layer-core)",
  },
  frameworks: {
    label: "Frameworks",
    description: "Strategic frameworks reference",
    color: "var(--layer-frameworks)",
  },
  clients: {
    label: "Clients",
    description: "Per-engagement context",
    color: "var(--layer-clients)",
  },
  market: {
    label: "Market",
    description: "Public data, research reports",
    color: "var(--layer-market)",
  },
  live: {
    label: "Live",
    description: "API-connected sources",
    color: "var(--layer-live)",
  },
};
