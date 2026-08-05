import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role !== "manager") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const via: string = String(body.via ?? "sms").trim(); // sms | email | both

  const sb = supabaseAdmin();
  const { data: proposal } = await sb
    .from("client_proposals")
    .select("*, proposal_options(*)")
    .eq("id", params.id)
    .single();

  if (!proposal) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!proposal.client_name) return NextResponse.json({ error: "Client name required" }, { status: 400 });

  const settings = await getSettings();
  const companyName = settings.company_name?.trim() || "SupplyHUB";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${baseUrl}/proposal/${proposal.token}`;

  const smsBody = `Hi ${proposal.client_name}, ${companyName} has sent you a price proposal for "${proposal.title}". Review and approve here: ${link}`;
  const emailSubject = `Price Proposal from ${companyName}`;
  const emailBody = `Hi ${proposal.client_name},\n\n${companyName} has prepared a price proposal for you regarding "${proposal.title}".\n\n${proposal.comment ? `${proposal.comment}\n\n` : ""}View and approve your proposal here:\n${link}\n\nThank you,\n${companyName}`;

  if (via === "sms" || via === "both") {
    const phone = proposal.client_phone ?? proposal.client_email ?? "";
    await notify({ to: phone, phone: proposal.client_phone, channels: ["sms"], subject: emailSubject, body: smsBody });
  }

  if (via === "email" || via === "both") {
    const email = proposal.client_email ?? "";
    await notify({ to: email, channels: ["email"], subject: emailSubject, body: emailBody });
  }

  // Update status to sent
  await sb.from("client_proposals").update({
    status: "sent",
    sent_via: via,
    updated_at: new Date().toISOString(),
  }).eq("id", params.id);

  return NextResponse.json({ ok: true, link });
}
