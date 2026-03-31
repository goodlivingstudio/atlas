import { readFileSync } from "fs";
import { resolve } from "path";
import { ingestDocument } from "../src/lib/ingest";

async function main() {
  const path = resolve(__dirname, "../knowledge/frameworks/frameworks-reference.md");
  const content = readFileSync(path, "utf-8");

  console.log("Ingesting Frameworks Reference...");

  const result = await ingestDocument({
    title: "Atlas Frameworks Reference",
    layer: "frameworks",
    sourcePath: "knowledge/frameworks/frameworks-reference.md",
    content,
    topics: [
      "brand-strategy", "product-strategy", "competitive-intelligence",
      "positioning", "innovation", "behavioral-economics",
      "challenger-brand", "jobs-to-be-done", "mental-availability",
      "organizational-strategy",
    ],
    confidenceDefault: "established_fact",
    metadata: { version: "1.0", type: "frameworks-reference" },
  });

  console.log(`\nDone: ${result.chunkCount} chunks, ~${result.totalTokens} tokens`);
}

main().catch((err) => { console.error(err); process.exit(1); });
