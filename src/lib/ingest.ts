import { getServiceClient } from "./supabase";
import { chunkDocument, generateEmbeddings } from "./embeddings";
import type { KnowledgeLayer } from "./types";

interface IngestOptions {
  title: string;
  layer: KnowledgeLayer;
  sourcePath: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function ingestDocument(options: IngestOptions) {
  const supabase = getServiceClient();
  const { title, layer, sourcePath, content, metadata = {} } = options;

  // Check if document already exists (by source_path)
  const { data: existing } = await supabase
    .from("documents")
    .select("id")
    .eq("source_path", sourcePath)
    .single();

  if (existing) {
    // Delete existing document + cascading chunks
    await supabase.from("documents").delete().eq("id", existing.id);
    console.log(`Replaced existing document: ${sourcePath}`);
  }

  // Insert document
  const { data: doc, error: docError } = await supabase
    .from("documents")
    .insert({
      title,
      layer,
      source_path: sourcePath,
      content,
      metadata,
    })
    .select()
    .single();

  if (docError || !doc) {
    throw new Error(`Failed to insert document: ${docError?.message}`);
  }

  // Chunk the document
  const chunks = chunkDocument(content);
  console.log(`Split "${title}" into ${chunks.length} chunks`);

  // Generate embeddings in batch
  const chunkTexts = chunks.map((c) => c.content);
  const embeddings = await generateEmbeddings(chunkTexts);

  // Insert chunks with embeddings
  const chunkRows = chunks.map((chunk, i) => ({
    document_id: doc.id,
    chunk_index: i,
    content: chunk.content,
    embedding: JSON.stringify(embeddings[i]),
    token_count: chunk.tokenCount,
    metadata: { position: i === 0 ? "start" : i === chunks.length - 1 ? "end" : "middle" },
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
