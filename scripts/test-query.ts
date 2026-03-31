import { queryKnowledgeBase } from "../src/lib/retrieve";

async function main() {
  const query = process.argv[2] || "What are the core operating principles of Atlas?";

  console.log(`\nQuery: "${query}"\n`);
  console.log("Retrieving...\n");

  const result = await queryKnowledgeBase(query);

  console.log("=".repeat(60));
  console.log("ATLAS RESPONSE");
  console.log("=".repeat(60));
  console.log(result.answer);
  console.log("\n" + "-".repeat(60));
  console.log("SOURCES");
  console.log("-".repeat(60));
  for (const source of result.sources) {
    console.log(
      `  [${source.layer}] "${source.document_title}" chunk ${source.chunk_index} — ${(source.similarity * 100).toFixed(1)}% match`
    );
  }
}

main().catch((err) => {
  console.error("Query failed:", err);
  process.exit(1);
});
