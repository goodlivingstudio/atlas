import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export async function GET() {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("documents")
    .select("id, title, layer, source_path, metadata, content, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const documents = (data || []).map((doc) => ({
    id: doc.id,
    title: doc.title,
    layer: doc.layer,
    source_path: doc.source_path,
    metadata: doc.metadata ?? {},
    content: typeof doc.content === "string" ? doc.content.slice(0, 1000) : "",
  }));

  return NextResponse.json({ documents });
}
