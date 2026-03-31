import { getServiceClient } from "./supabase";
import { chunkDocument, generateEmbeddings } from "./embeddings";
import type { KnowledgeLayer, ConfidenceTier, TopicTag } from "./types";

export interface IngestOptions {
  title: string;
  layer: KnowledgeLayer;
  sourcePath: string;
  content: string;
  topics?: TopicTag[];
  confidenceDefault?: ConfidenceTier;
  metadata?: Record<string, unknown>;
}

export async function ingestDocument(options: IngestOptions) {
  const supabase = getServiceClient();
  const {
    title,
    layer,
    sourcePath,
    content,
    topics = [],
    confidenceDefault = "established_fact",
    metadata = {},
  } = options;

  // Replace existing document (cascades to chunks via FK)
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("source_path", sourcePath)
    .single();

  if (existing) {
    await supabase.from("documents").delete().eq("id", existing.id);
    console.log(`Replaced existing document: ${sourcePath}`);
  }

  // Insert document record
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title,
      layer,
      source_path: sourcePath,
      content,
      metadata: { ...metadata, topics, confidence_default: confidenceDefault },
    })
    .select()
    .single();

  if (docError || !doc) {
    throw new Error(`Failed to insert document: ${docError?.message}`);
  }

  // Structural chunking — heading/paragraph-aware
  const chunks = chunkDocument(content);
  console.log(`Split "${title}" into ${chunks.length} chunks`);

  // Batch embed
  const chunkTexts = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(chunkTexts);

  // Build chunk rows with enriched metadata
  const chunkRows = chunks.map((chunk, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    token_count: chunk.tokenCount,
    metadata: {
      section_heading: chunk.sectionHeading,
      position: i === 0 ? "start" : i === chunks.length - 1 ? "end" : "middle",
      topics,
      confidence_tier: confidenceDefault,
    },
  }));

  const { error: chunkError } = await supabase
    .from("document_chunks")
    .insert(chunkRows);

  if (chunkError) {
    throw new Error(`Failed to insert chunks: ${chunkError.message}`);
  }

  console.log(`Ingested "${title}" (${chunks.length} chunks, layer: ${layer})`);

  return {
    documentId: doc.id,
    chunkCount: chunks.length,
    totalTokens: chunks.reduce((sum, c) => sum + c.tokenCount, 0),
  };
}
