import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getSettings } from "@/lib/settings";
import { notify } from "@/lib/notify";
import {
  DEFAULT_SMS_CLIENT_RESPONSE,
  appBaseUrl,
  fillTemplate,
} from "@/lib/notifyTemplates";

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

async function notifyManagerOfClientResponse(opts: {
  proposalId: string;
  token: string;
  action: "approved" | "declined";
  optionId: string | null;
}) {
  const sb = supabaseAdmin();
  const settings = await getSettings();
  const phone = settings.manager_phone?.trim() || settings.contact_phone?.trim() || null;
  if (!phone) return;

  const { data: proposal } = await sb
    .from("client_proposals")
    .select("id, title, client_name, request_id, markup_pct, token")
    .eq("id", opts.proposalId)
    .maybeSingle();
  if (!proposal) return;

  let optionLabel = "";
  let price = "";
  let currency = "USD";
  if (opts.optionId) {
    const { data: opt } = await sb
      .from("proposal_options")
      .select("label, base_price, currency")
      .eq("id", opts.optionId)
      .maybeSingle();
    if (opt) {
      const markup = Number(proposal.markup_pct ?? 20);
      const final = Math.round(Number(opt.base_price) * (1 + markup / 100) * 100) / 100;
      optionLabel = String(opt.label ?? "");
      currency = String(opt.currency ?? "USD");
      price = final.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }

  const priceLine =
    opts.action === "approved" && price
      ? ` · ${currency} ${price}`
      : "";

  const link = `${appBaseUrl()}/manager/requests/${proposal.request_id}`;
  const template =
    settings.sms_client_response_template?.trim() || DEFAULT_SMS_CLIENT_RESPONSE;
  const body = fillTemplate(template, {
    company_name: settings.company_name?.trim() || "SupplyHUB",
    manager_name: settings.manager_name?.trim() || settings.contact_name?.trim() || "there",
    client_name: proposal.client_name || "A client",
    title: proposal.title || "Proposal",
    action: opts.action,
    option_label: optionLabel,
    price,
    currency,
    price_line: priceLine,
    link,
  });

  await notify({
    to: phone,
    phone,
    channels: ["sms"],
    subject: `Client ${opts.action} proposal`,
    body,
  });
}

// POST /api/proposal/[token]/respond — client approves or rejects
export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  const sb = supabaseAdmin();
  const { data: proposal } = await sb
    .from("client_proposals")
    .select("id, status, token")
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

    try {
      await notifyManagerOfClientResponse({
        proposalId: proposal.id as string,
        token: String(proposal.token),
        action: "approved",
        optionId,
      });
    } catch (e) {
      console.error("[proposal] manager SMS failed", e);
    }

    return NextResponse.json({ ok: true, status: "approved" });
  }

  if (action === "reject") {
    await sb.from("client_proposals").update({
      status: "rejected",
      updated_at: new Date().toISOString(),
    }).eq("id", proposal.id);

    try {
      await notifyManagerOfClientResponse({
        proposalId: proposal.id as string,
        token: String(proposal.token),
        action: "declined",
        optionId: null,
      });
    } catch (e) {
      console.error("[proposal] manager SMS failed", e);
    }

    return NextResponse.json({ ok: true, status: "rejected" });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
