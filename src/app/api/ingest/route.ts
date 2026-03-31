import { NextRequest, NextResponse } from "next/server";
import { ingestDocument } from "@/lib/ingest";
import type { KnowledgeLayer } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, layer, sourcePath, content, metadata } = body;

    if (!title || !layer || !sourcePath || !content) {
      return NextResponse.json(
        { error: "Missing required fields: title, layer, sourcePath, content" },
        { status: 400 }
      );
    }

    const result = await ingestDocument({
      title,
      layer: layer as KnowledgeLayer,
      sourcePath,
      content,
      metadata,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Ingestion failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
