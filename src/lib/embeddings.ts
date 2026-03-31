import { VoyageAIClient } from "voyageai";

let _voyage: VoyageAIClient | null = null;
function getVoyage() {
  if (!_voyage) _voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  return _voyage;
}

const EMBEDDING_MODEL = "voyage-3";
const MAX_CHUNK_TOKENS = 500;
const CHUNK_OVERLAP = 50;

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getVoyage().embed({
    model: EMBEDDING_MODEL,
    input: text,
    inputType: "query",
  });
  return response.data![0].embedding as number[];
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await getVoyage().embed({
    model: EMBEDDING_MODEL,
    input: texts,
    inputType: "document",
  });
  return response.data!.map((d) => d.embedding as number[]);
}

// Simple word-count based chunking (good enough for POC)
export function chunkDocument(
  content: string,
  maxTokens = MAX_CHUNK_TOKENS,
  overlap = CHUNK_OVERLAP
): Array<{ content: string; tokenCount: number }> {
  const words = content.split(/\s+/);
  const chunks: Array<{ content: string; tokenCount: number }> = [];

  // Rough token estimate: 1 word ≈ 1.3 tokens
  const wordsPerChunk = Math.floor(maxTokens / 1.3);
  const overlapWords = Math.floor(overlap / 1.3);

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunkWords = words.slice(start, end);
    const chunkContent = chunkWords.join(" ");
    const tokenEstimate = Math.ceil(chunkWords.length * 1.3);

    chunks.push({ content: chunkContent, tokenCount: tokenEstimate });

    if (end >= words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}
