import { createClient } from "@supabase/supabase-js";

function getUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  return url;
}

function getAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
  return key;
}

// Client-side Supabase (anon key, row-level security)
// Lazy — only throws when actually used without env vars
let _client: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  if (!_client) _client = createClient(getUrl(), getAnonKey());
  return _client;
}

// Backwards compat — use getSupabase() in new code
export const supabase = new Proxy({} as ReturnType<typeof createClient>, {
  get(_, prop) {
    return (getSupabase() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

// Server-side Supabase (service role, bypasses RLS — for ingestion pipeline)
export function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(getUrl(), serviceKey);
}
