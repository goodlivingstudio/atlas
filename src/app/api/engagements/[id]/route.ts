import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServiceClient();
  const { id } = await params;

  const { data, error } = await supabase
    .from("engagements")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { name, company, url, brief, notes, status } = body as {
      name?: string;
      company?: string;
      url?: string;
      brief?: string;
      notes?: string;
      status?: string;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name     !== undefined) updates.name    = name;
    if (company  !== undefined) updates.company = company;
    if (url      !== undefined) updates.url     = url;
    if (brief    !== undefined) updates.brief   = brief;
    if (notes    !== undefined) updates.notes   = notes;
    if (status   !== undefined) updates.status  = status;

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("engagements")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = getServiceClient();
  const { id } = await params;

  const { error } = await supabase.from("engagements").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
