import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

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
  const { name, company, url, brief, notes, competitive_set } = body;

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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
