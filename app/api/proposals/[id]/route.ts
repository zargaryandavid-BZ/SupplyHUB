import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/proposals/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: proposal } = await sb.from("client_proposals").select("*").eq("id", params.id).single();
  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: options } = await sb.from("proposal_options").select("*").eq("proposal_id", params.id).order("position");
  return NextResponse.json({ proposal: { ...proposal, options: options ?? [] } });
}

// PATCH /api/proposals/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sb = supabaseAdmin();
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  const allowed = ["title", "comment", "markup_pct", "client_name", "client_email", "client_phone", "status"];
  for (const k of allowed) {
    if (body[k] !== undefined) updates[k] = body[k];
  }

  await sb.from("client_proposals").update(updates).eq("id", params.id);

  if (body.options !== undefined) {
    await sb.from("proposal_options").delete().eq("proposal_id", params.id);
    const opts = body.options as Array<{ label: string; base_price: number; currency: string }>;
    if (opts.length) {
      await sb.from("proposal_options").insert(
        opts.map((o, i) => ({
          proposal_id: params.id,
          label: String(o.label ?? "").trim(),
          base_price: Number(o.base_price ?? 0),
          currency: String(o.currency ?? "USD"),
          position: i,
        }))
      );
    }
  }

  const { data: proposal } = await sb.from("client_proposals").select("*").eq("id", params.id).single();
  const { data: options } = await sb.from("proposal_options").select("*").eq("proposal_id", params.id).order("position");
  return NextResponse.json({ proposal: { ...proposal, options: options ?? [] } });
}

// DELETE /api/proposals/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await supabaseAdmin().from("client_proposals").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
