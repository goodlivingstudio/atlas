import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  const checks: Record<string, { status: string; detail?: string }> = {};

  // Check env vars
  checks.anthropic = {
    status: process.env.ANTHROPIC_API_KEY ? "ok" : "missing",
  };
  checks.openai = {
    status: process.env.OPENAI_API_KEY ? "ok" : "missing",
  };
  checks.supabase_url = {
    status: process.env.NEXT_PUBLIC_SUPABASE_URL ? "ok" : "missing",
  };
  checks.supabase_anon = {
    status: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "ok" : "missing",
  };
  checks.supabase_service = {
    status: process.env.SUPABASE_SERVICE_ROLE_KEY ? "ok" : "missing",
  };

  // Test Supabase connection
  try {
    const { count, error } = await supabase
      .from("documents")
      .select("*", { count: "exact", head: true });

    if (error) {
      checks.supabase_connection = { status: "error", detail: error.message };
    } else {
      checks.supabase_connection = {
        status: "ok",
        detail: `${count ?? 0} documents`,
      };
    }
  } catch {
    checks.supabase_connection = { status: "unreachable" };
  }

  const allOk = Object.values(checks).every((c) => c.status === "ok");

  return NextResponse.json({
    status: allOk ? "healthy" : "degraded",
    checks,
  });
}
