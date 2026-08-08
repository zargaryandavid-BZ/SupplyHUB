import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getSettings } from "@/lib/settings";
import { ClientProposalView } from "@/components/ClientProposalView";
import { publicLogoUrl, signedAttachmentUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ProposalPage({ params }: { params: { token: string } }) {
  const sb = supabaseAdmin();
  const { data: proposal } = await sb
    .from("client_proposals")
    .select("id, request_id, title, comment, markup_pct, delivery_date, quantity, images, client_name, status, approved_option_id, token")
    .eq("token", params.token)
    .maybeSingle();

  if (!proposal) notFound();

  const { data: rawOptions } = await sb
    .from("proposal_options")
    .select("id, label, base_price, currency, note, position")
    .eq("proposal_id", proposal.id)
    .order("position");

  // Fetch the underlying request for product details + attachments
  const { data: req } = await sb
    .from("product_requests")
    .select("category, quantity, material, finishing, specs, width, height, depth, size_unit, needed_by, attachments")
    .eq("id", proposal.request_id)
    .maybeSingle();

  const proposalImages = Array.isArray(proposal.images) ? (proposal.images as string[]) : [];
  let images = proposalImages.slice(0, 4);
  if (images.length === 0 && req?.attachments) {
    try {
      const keys: string[] = JSON.parse(req.attachments as string);
      images = (
        await Promise.all(keys.slice(0, 4).map((key) => signedAttachmentUrl(key)))
      ).filter(Boolean);
    } catch {
      /* ignore */
    }
  }

  const markup = Number(proposal.markup_pct ?? 20);
  const options = (rawOptions ?? []).map((o) => ({
    id: o.id as string,
    label: o.label as string,
    currency: o.currency as string,
    note: (o.note as string | null) ?? null,
    final_price: Math.round(Number(o.base_price) * (1 + markup / 100) * 100) / 100,
  }));

  const settings = await getSettings();
  const logoUrl = publicLogoUrl(settings.logo_path);

  return (
    <ClientProposalView
      token={params.token}
      title={proposal.title as string}
      comment={proposal.comment as string | null}
      status={proposal.status as string}
      approvedOptionId={proposal.approved_option_id as string | null}
      options={options}
      companyName={settings.company_name ?? ""}
      companyAddress={settings.hq_address ?? null}
      companyPhone={settings.contact_phone ?? null}
      companyEmail={settings.contact_email ?? null}
      logoUrl={logoUrl}
      deliveryDate={(proposal.delivery_date as string | null) ?? null}
      images={images}
      requestDetails={req ? {
        category: req.category as string | null,
        quantity: (proposal.quantity != null
          ? Number(proposal.quantity)
          : req.quantity as number | null),
        material: req.material as string | null,
        finishing: req.finishing as string | null,
        specs: req.specs as string | null,
        width: req.width as number | null,
        height: req.height as number | null,
        depth: req.depth as number | null,
        size_unit: req.size_unit as string | null,
        needed_by: req.needed_by as string | null,
      } : undefined}
    />
  );
}
