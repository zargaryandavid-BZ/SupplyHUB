import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";

export const dynamic = "force-dynamic";

// GET /api/proposal/[token] — public, no auth
export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const sb = supabaseAdmin();
  const { data: proposal } = await sb
    .from("client_proposals")
    .select("id, title, comment, markup_pct, client_name, status, approved_option_id")
    .eq("token", params.token)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: options } = await sb
    .from("proposal_options")
    .select("id, label, base_price, currency, position")
    .eq("proposal_id", proposal.id)
    .order("position");

  const markup = Number(proposal.markup_pct ?? 20);
  const enrichedOptions = (options ?? []).map((o) => ({
    id: o.id,
    label: o.label,
    currency: o.currency,
    // Only final price visible to client — base_price hidden
    final_price: Math.round(Number(o.base_price) * (1 + markup / 100) * 100) / 100,
  }));

  return NextResponse.json({
    proposal: {
      title: proposal.title,
      comment: proposal.comment,
      client_name: proposal.client_name,
      status: proposal.status,
      approved_option_id: proposal.approved_option_id,
      options: enrichedOptions,
    }
  });
}

// POST /api/proposal/[token]/respond — client approves or rejects
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = supabaseAdmin();
  const { data: proposal } = await sb
    .from("client_proposals")
    .select("id, status")
    .eq("token", params.token)
    .maybeSingle();

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (proposal.status === "approved" || proposal.status === "rejected") {
    return NextResponse.json({ error: "Already responded" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const action: string = String(body.action ?? "");
  const optionId: string | null = body.option_id ?? null;

  if (action === "approve") {
    await sb.from("client_proposals").update({
      status: "approved",
      approved_option_id: optionId,
      updated_at: new Date().toISOString(),
    }).eq("id", proposal.id);
    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "reject") {
    await sb.from("client_proposals").update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    }).eq("id", proposal.id);
    return NextResponse.json({ ok: true, status: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
