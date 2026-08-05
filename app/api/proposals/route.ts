import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";

export const dynamic = "force-dynamic";

// GET /api/proposals?request_id=X[&quote_id=Y]
export async function GET(req: NextRequest) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = req.nextUrl;
  const requestId = url.searchParams.get("request_id");
  const quoteId = url.searchParams.get("quote_id");
  if (!requestId) return NextResponse.json({ error: "request_id required" }, { status: 400 });

  const sb = supabaseAdmin();
  let q = sb.from("client_proposals").select("*").eq("request_id", Number(requestId));
  if (quoteId) q = q.eq("quote_id", Number(quoteId));
  const { data: proposals } = await q.order("created_at", { ascending: false });

  // Attach options to each proposal
  const ids = (proposals ?? []).map((p) => p.id as string);
  const { data: options } = ids.length
    ? await sb.from("proposal_options").select("*").in("proposal_id", ids).order("position")
    : { data: [] };

  const optsByProposal: Record<string, unknown[]> = {};
  for (const o of options ?? []) {
    const pid = o.proposal_id as string;
    if (!optsByProposal[pid]) optsByProposal[pid] = [];
    optsByProposal[pid].push(o);
  }

  const result = (proposals ?? []).map((p) => ({
    ...p,
    options: optsByProposal[p.id as string] ?? [],
  }));

  return NextResponse.json({ proposals: result });
}

// POST /api/proposals — create or upsert proposal + options
export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const sb = supabaseAdmin();
  const now = new Date().toISOString();

  const payload = {
    request_id: Number(body.request_id),
    quote_id: body.quote_id ? Number(body.quote_id) : null,
    title: String(body.title ?? "").trim(),
    comment: String(body.comment ?? "").trim() || null,
    markup_pct: Number(body.markup_pct ?? 20),
    client_name: String(body.client_name ?? "").trim(),
    client_email: String(body.client_email ?? "").trim() || null,
    client_phone: String(body.client_phone ?? "").trim() || null,
    status: "draft",
    updated_at: now,
  };

  let proposalId: string;

  if (body.id) {
    // Update existing
    await sb.from("client_proposals").update(payload).eq("id", body.id);
    proposalId = body.id;
    // Replace options
    await sb.from("proposal_options").delete().eq("proposal_id", proposalId);
  } else {
    const { data: row } = await sb
      .from("client_proposals")
      .insert({ ...payload, created_at: now })
      .select("id")
      .single();
    if (!row) return NextResponse.json({ error: "Failed to create" }, { status: 500 });
    proposalId = row.id as string;
  }

  // Insert options
  const opts = (body.options ?? []) as Array<{ label: string; base_price: number; currency: string }>;
  if (opts.length) {
    await sb.from("proposal_options").insert(
      opts.map((o, i) => ({
        proposal_id: proposalId,
        label: String(o.label ?? "").trim(),
        base_price: Number(o.base_price ?? 0),
        currency: String(o.currency ?? "USD"),
        position: i,
      }))
    );
  }

  const { data: proposal } = await sb.from("client_proposals").select("*").eq("id", proposalId).single();
  const { data: options } = await sb.from("proposal_options").select("*").eq("proposal_id", proposalId).order("position");

  return NextResponse.json({ proposal: { ...proposal, options: options ?? [] } }, { status: 201 });
}
