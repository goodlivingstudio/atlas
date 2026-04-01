import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { ingestDocument } from "@/lib/ingest";

export const runtime = "nodejs";

export async function GET() {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from("engagements")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  const body = await request.json();
  const {
    name,
    company,
    url,
    brief,
    notes,
    competitive_set,
    source_text,
    source_filename,
    analysis_metadata,
  } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("engagements")
    .insert({
      name: name.trim(),
      company: company?.trim() || null,
      url: url?.trim() || null,
      brief: brief?.trim() || null,
      notes: notes?.trim() || null,
      competitive_set: competitive_set || [],
      status: "intake",
      metadata: analysis_metadata || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ingest source document if provided
  if (source_text) {
    const engagementId = data.id;
    try {
      const result = await ingestDocument({
        title: name.trim(),
        layer: "clients",
        sourcePath: `engagement/${engagementId}/${source_filename || "document"}`,
        content: source_text,
        metadata: {
          engagement_id: engagementId,
          ...(analysis_metadata || {}),
        },
      });
      return NextResponse.json(
        { ...data, ingested: true, chunkCount: result.chunkCount },
        { status: 201 }
      );
    } catch (ingestErr) {
      const ingestError =
        ingestErr instanceof Error ? ingestErr.message : "Ingest failed";
      return NextResponse.json(
        { ...data, ingested: false, ingestError },
        { status: 201 }
      );
    }
  }

  return NextResponse.json({ ...data, ingested: false }, { status: 201 });
}
