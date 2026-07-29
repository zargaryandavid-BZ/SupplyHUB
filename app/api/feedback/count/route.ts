import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getActor();
  if (actor.role === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { count } = await supabaseAdmin()
    .from("feedback")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({ count: count ?? 0 });
}
