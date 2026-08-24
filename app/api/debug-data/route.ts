import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = supabaseAdmin();
  const results: Record<string, unknown> = {};

  const tables = ["product_requests", "partners", "orders", "dispatches", "clients"];
  for (const t of tables) {
    const { data, error } = await sb.from(t).select("*", { count: "exact", head: true });
    results[t] = error ? `ERROR: ${error.message}` : `OK (check count)`;
  }

  const { count: reqCount, error: reqErr } = await sb
    .from("product_requests")
    .select("*", { count: "exact", head: true });
  results["product_requests_count"] = reqErr ? `ERROR: ${reqErr.message}` : reqCount;

  const { count: partnerCount, error: partErr } = await sb
    .from("partners")
    .select("*", { count: "exact", head: true });
  results["partners_count"] = partErr ? `ERROR: ${partErr.message}` : partnerCount;

  return NextResponse.json(results, { status: 200 });
}
