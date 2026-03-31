import { readFileSync } from "fs";
import { resolve } from "path";
import { ingestDocument } from "../src/lib/ingest";

async function main() {
  const doctrinePath = resolve(__dirname, "../knowledge/core/atlas-doctrine.md");
  const content = readFileSync(doctrinePath, "utf-8");

  console.log("Ingesting Atlas Core Doctrine...");
  console.log(`Content length: ${content.length} characters`);

  const result = await ingestDocument({
    title: "Atlas Core Doctrine",
    layer: "core",
    sourcePath: "knowledge/core/atlas-doctrine.md",
    content,
    metadata: {
      version: "1.0",
      type: "doctrine",
      author: "Jeremy Grant",
    },
  });

  console.log("\nIngestion complete:");
  console.log(`  Document ID: ${result.documentId}`);
  console.log(`  Chunks: ${result.chunkCount}`);
  console.log(`  Total tokens (est): ${result.totalTokens}`);
}

main().catch((err) => {
  console.error("Ingestion failed:", err);
  process.exit(1);
});
