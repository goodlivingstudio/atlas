import { readFileSync } from "fs";
import { resolve } from "path";
import { ingestDocument } from "../src/lib/ingest";

async function main() {
  const path = resolve(__dirname, "../knowledge/core/agent-operating-protocol.md");
  const content = readFileSync(path, "utf-8");

  console.log("Ingesting Agent Operating Protocol...");

  const result = await ingestDocument({
    title: "Atlas Agent Operating Protocol",
    layer: "core",
    sourcePath: "knowledge/core/agent-operating-protocol.md",
    content,
    metadata: { version: "1.0", type: "protocol" },
  });

  console.log(`\nDone: ${result.chunkCount} chunks, ~${result.totalTokens} tokens`);
}

main().catch((err) => { console.error(err); process.exit(1); });
