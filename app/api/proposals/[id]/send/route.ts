import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";
import { notify } from "@/lib/notify";
import { appBaseUrl } from "@/lib/notifyTemplates";

export const dynamic = "force-dynamic";

// POST /api/proposals/[id]/send
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const via: string = body.via ?? "email"; // "email" | "sms" | "both"

  const sb = supabaseAdmin();

  const { data: proposal, error: fetchErr } = await sb
    .from("client_proposals")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchErr || !proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
  }

  const clientLink = `${appBaseUrl()}/proposal/${proposal.token}`;
  const subject = `Your quote is ready — ${proposal.title || "Proposal"}`;
  const messageBody = [
    `Hi${proposal.client_name ? ` ${proposal.client_name}` : ""},`,
    "",
    `Your proposal "${proposal.title || "Proposal"}" is ready to review.`,
    "",
    `View it here: ${clientLink}`,
  ].join("\n");

  const channels: Array<"email" | "sms"> = [];
  if (via === "email" || via === "both") channels.push("email");
  if (via === "sms" || via === "both") channels.push("sms");

  const to = proposal.client_email || proposal.client_name || "client";
  const phone = proposal.client_phone ?? null;

  await notify({ to, phone, channels, subject, body: messageBody });

  // Mark proposal as sent
  await sb
    .from("client_proposals")
    .update({ status: "sent", sent_via: via, updated_at: new Date().toISOString() })
    .eq("id", params.id);

  const { data: updated } = await sb.from("client_proposals").select("*").eq("id", params.id).single();
  const { data: options } = await sb
    .from("proposal_options")
    .select("*")
    .eq("proposal_id", params.id)
    .order("position");

  return NextResponse.json({ proposal: { ...updated, options: options ?? [] } });
}
