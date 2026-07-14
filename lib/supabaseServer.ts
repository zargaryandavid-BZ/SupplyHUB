import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a cached Supabase client using the service-role key.
 * Bypasses RLS — safe only because every call is server-side (server components + server actions).
 * RLS + per-user anon client will replace this in Step 2 (auth migration).
 * NEVER import this module into a "use client" component.
 *
 * The client is cached on globalThis so it's reused across hot-reloads in dev
 * and across requests in the same Node.js process, avoiding the connection
 * overhead of creating a new client on every request.
 */
const g = globalThis as unknown as { __supabaseAdmin?: SupabaseClient };

export function supabaseAdmin(): SupabaseClient {
  if (!g.__supabaseAdmin) {
    g.__supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );
  }
  return g.__supabaseAdmin;
}
