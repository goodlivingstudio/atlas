import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import type { KnowledgeLayer } from "@/lib/types";

export async function GET() {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, layer, created_at, updated_at");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: chunkCounts } = await supabase
    .from("document_chunks")
    .select("document_id");

  const countsByDoc = (chunkCounts || []).reduce<Record<string, number>>((acc, row) => {
    acc[row.document_id] = (acc[row.document_id] || 0) + 1;
    return acc;
  }, {});

  const byLayer = (data || []).reduce<Record<KnowledgeLayer, { documents: number; chunks: number }>>((acc, doc) => {
    const layer = doc.layer as KnowledgeLayer;
    if (!acc[layer]) acc[layer] = { documents: 0, chunks: 0 };
    acc[layer].documents += 1;
    acc[layer].chunks += countsByDoc[doc.id] || 0;
    return acc;
  }, {} as Record<KnowledgeLayer, { documents: number; chunks: number }>);

  return NextResponse.json({
    total_documents: data?.length || 0,
    total_chunks: chunkCounts?.length || 0,
    by_layer: byLayer,
    documents: (data || []).map((d) => ({
      id: d.id,
      title: d.title,
      layer: d.layer,
      chunks: countsByDoc[d.id] || 0,
      ingested_at: d.created_at,
    })),
  });
}
