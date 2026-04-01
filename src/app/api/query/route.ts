import { NextRequest, NextResponse } from "next/server";
import { queryKnowledgeBase } from "@/lib/retrieve";
import { getServiceClient } from "@/lib/supabase";
import type { AtlasMode, KnowledgeLayer } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, mode, layer, top_k, engagement_id, conversation_history } = body;

    if (!query) {
      return NextResponse.json(
        { error: "Missing required field: query" },
        { status: 400 }
      );
    }

    const result = await queryKnowledgeBase(query, {
      mode: (mode as AtlasMode) || "DIAGNOSIS",
      layer: layer as KnowledgeLayer | undefined,
      topK: top_k,
      engagementId: engagement_id,
      conversationHistory: conversation_history,
    });

    // Save to queries table (fire-and-forget, don't fail the response)
    try {
      const supabase = getServiceClient();
      await supabase.from("queries").insert({
        engagement_id: engagement_id || null,
        query: result.query,
        mode: (mode as AtlasMode) || "DIAGNOSIS",
        answer: result.answer,
        sources: result.sources,
      });
    } catch {
      // Silently ignore save errors — query result is more important
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
