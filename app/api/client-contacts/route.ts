import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/client-contacts?q=search_term
export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ contacts: [] });

  const { data } = await supabaseAdmin()
    .from("client_contacts")
    .select("id, name, email, phone")
    .or(`name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
    .order("last_used_at", { ascending: false })
    .limit(8);

  return NextResponse.json({ contacts: data ?? [] });
}

// POST /api/client-contacts — upsert by email or phone
export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim() || null;
  const phone = String(body.phone ?? "").trim() || null;
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const sb = supabaseAdmin();
  const now = new Date().toISOString();

  // Try to find existing by email or phone
  let existing = null;
  if (email) {
    const { data } = await sb.from("client_contacts").select("id").eq("email", email).maybeSingle();
    existing = data;
  }
  if (!existing && phone) {
    const { data } = await sb.from("client_contacts").select("id").eq("phone", phone).maybeSingle();
    existing = data;
  }

  if (existing) {
    await sb.from("client_contacts").update({ name, email, phone, last_used_at: now }).eq("id", existing.id);
  } else {
    await sb.from("client_contacts").insert({ name, email, phone, last_used_at: now, created_at: now });
  }

  return NextResponse.json({ ok: true });
}
