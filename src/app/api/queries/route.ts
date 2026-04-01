import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

// GET /api/queries?engagement_id=X — fetch query history for engagement
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  const { searchParams } = new URL(request.url);
  const engagementId = searchParams.get("engagement_id");

  let query = supabase
    .from("queries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  if (engagementId) {
    query = query.eq("engagement_id", engagementId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST /api/queries — save a query result
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  const body = await request.json();
  const { engagement_id, query, mode, answer, sources } = body;

  if (!query || !mode || !answer) {
    return NextResponse.json(
      { error: "Missing required fields: query, mode, answer" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("queries")
    .insert({
      engagement_id: engagement_id || null,
      query,
      mode,
      answer,
      sources: sources || [],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
