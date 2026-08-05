import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getSettings } from "@/lib/settings";
import { ClientProposalView } from "@/components/ClientProposalView";
import { publicLogoUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const sb = supabaseAdmin();
  const { data: proposal } = await sb
    .from("client_proposals")
    .select("id, title, comment, markup_pct, client_name, status, approved_option_id, token")
    .eq("token", params.token)
    .maybeSingle();

  if (!proposal) notFound();

  const { data: rawOptions } = await sb
    .from("proposal_options")
    .select("id, label, base_price, currency, position")
    .eq("proposal_id", proposal.id)
    .order("position");

  const markup = Number(proposal.markup_pct ?? 20);
  const options = (rawOptions ?? []).map((o) => ({
    id: o.id as string,
    label: o.label as string,
    currency: o.currency as string,
    final_price: Math.round(Number(o.base_price) * (1 + markup / 100) * 100) / 100,
  }));

  const settings = await getSettings();
  const logoUrl = publicLogoUrl(settings.logo_path);

  return (
    <ClientProposalView
      token={params.token}
      title={proposal.title as string}
      comment={proposal.comment as string | null}
      clientName={proposal.client_name as string}
      status={proposal.status as string}
      approvedOptionId={proposal.approved_option_id as string | null}
      options={options}
      companyName={settings.company_name ?? ""}
      companyAddress={settings.hq_address ?? null}
      logoUrl={logoUrl}
    />
  );
}
