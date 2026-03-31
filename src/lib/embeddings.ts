import { VoyageAIClient } from "voyageai";

let _voyage: VoyageAIClient | null = null;
function getVoyage() {
  if (!_voyage) _voyage = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });
  return _voyage;
}

const EMBEDDING_MODEL = "voyage-3";
export const MAX_CHUNK_TOKENS = 500;
export const CHUNK_OVERLAP_TOKENS = 50;

// ─── Embeddings ────────────────────────────────────────────────────────────

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

// ─── Structural Chunker ────────────────────────────────────────────────────
//
// Strategy (in order of preference):
//   1. Split on markdown headings (H1–H3) to get sections
//   2. Within each section, split on paragraph breaks (\n\n) if too large
//   3. Within each paragraph, split on sentences if still too large
//   4. Apply token overlap between adjacent chunks
//
// This preserves semantic context far better than word-count splitting.
// A chunk always contains a complete idea, not an arbitrary word window.

export interface Chunk {
  content: string;
  tokenCount: number;
  sectionHeading: string; // nearest heading above this chunk
}

/** Rough token estimate: 1 word ≈ 1.3 tokens */
function estimateTokens(text: string): number {
  return Math.ceil(text.trim().split(/\s+/).length * 1.3);
}

/** Split markdown content into heading-bounded sections */
function splitIntoSections(content: string): Array<{ heading: string; body: string }> {
  const lines = content.split("\n");
  const sections: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } = { heading: "", body: [] };

  for (const line of lines) {
    if (/^#{1,3}\s/.test(line)) {
      // Flush current section before starting a new one
      if (current.heading || current.body.some((l) => l.trim())) {
        sections.push(current);
      }
      current = { heading: line.trim(), body: [] };
    } else {
      current.body.push(line);
    }
  }
  // Flush final section
  if (current.heading || current.body.some((l) => l.trim())) {
    sections.push(current);
  }

  return sections.map((s) => ({
    heading: s.heading,
    body: s.body.join("\n").trim(),
  }));
}

/** Split a block of text into paragraphs (\n\n boundaries) */
function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** Split a paragraph into sentences as a last resort */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Pack lines/sentences into chunks under maxTokens,
 * returning chunk text strings with the section heading prepended.
 */
function packIntoChunks(
  units: string[],
  sectionHeading: string,
  maxTokens: number,
  overlapTokens: number
): Chunk[] {
  const chunks: Chunk[] = [];
  // Heading prefix added to every chunk for retrieval context
  const headingPrefix = sectionHeading ? `${sectionHeading}\n\n` : "";
  const headingTokens = estimateTokens(headingPrefix);

  let currentUnits: string[] = [];
  let currentTokens = headingTokens;

  function flush() {
    if (!currentUnits.length) return;
    const text = headingPrefix + currentUnits.join("\n\n");
    chunks.push({ content: text, tokenCount: estimateTokens(text), sectionHeading });
  }

  for (const unit of units) {
    const unitTokens = estimateTokens(unit);

    // Unit alone exceeds budget — force it in as its own chunk
    if (unitTokens + headingTokens > maxTokens && currentUnits.length === 0) {
      const text = headingPrefix + unit;
      chunks.push({ content: text, tokenCount: estimateTokens(text), sectionHeading });
      continue;
    }

    // Adding this unit would exceed budget — flush first
    if (currentTokens + unitTokens > maxTokens) {
      flush();
      // Carry overlap: take last N tokens worth of units into the new chunk
      const overlapUnits: string[] = [];
      let overlapSoFar = headingTokens;
      for (let i = currentUnits.length - 1; i >= 0; i--) {
        const t = estimateTokens(currentUnits[i]);
        if (overlapSoFar + t > overlapTokens + headingTokens) break;
        overlapUnits.unshift(currentUnits[i]);
        overlapSoFar += t;
      }
      currentUnits = overlapUnits;
      currentTokens = overlapSoFar;
    }

    currentUnits.push(unit);
    currentTokens += unitTokens;
  }

  flush();
  return chunks;
}

export function chunkDocument(
  content: string,
  maxTokens = MAX_CHUNK_TOKENS,
  overlapTokens = CHUNK_OVERLAP_TOKENS
): Chunk[] {
  const sections = splitIntoSections(content);
  const allChunks: Chunk[] = [];

  for (const { heading, body } of sections) {
    if (!body) continue;

    const sectionTokens = estimateTokens((heading ? heading + "\n\n" : "") + body);

    // Section fits in one chunk — keep it whole
    if (sectionTokens <= maxTokens) {
      const text = heading ? `${heading}\n\n${body}` : body;
      allChunks.push({ content: text, tokenCount: estimateTokens(text), sectionHeading: heading });
      continue;
    }

    // Section too large — split by paragraphs
    const paragraphs = splitIntoParagraphs(body);
    const units: string[] = [];

    for (const para of paragraphs) {
      const paraTokens = estimateTokens(para);
      if (paraTokens + estimateTokens(heading ? heading + "\n\n" : "") <= maxTokens) {
        units.push(para);
      } else {
        // Paragraph too large — split by sentences
        const sentences = splitIntoSentences(para);
        units.push(...sentences);
      }
    }

    allChunks.push(...packIntoChunks(units, heading, maxTokens, overlapTokens));
  }

  return allChunks;
}
