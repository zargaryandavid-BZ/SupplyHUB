import { supabaseAdmin } from "./supabaseServer";
import { now } from "./util";
import type { Partner, PartnerProduct } from "./types";

export type PartnerInput = {
  company: string;
  products?: PartnerProduct[];
  contact?: string | null;
  email?: string | null;
  phone?: string | null;
  categories?: string | null;
  location?: string | null;
  preferred_channels?: string | null;
  avg_delivery_days?: number | null;
  website?: string | null;
  ein?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  swift?: string | null;
  payment_terms?: string | null;
  portal_contact_name?: string | null;
  portal_email?: string | null;
  logo_path?: string | null;
};

export async function addPartner(input: PartnerInput): Promise<Partner> {
  const row = {
    company: input.company,
    contact: input.contact ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    categories: input.categories ?? null,
    rating: 0,
    active: 1,
    location: input.location ?? null,
    preferred_channels: input.preferred_channels ?? null,
    avg_delivery_days: input.avg_delivery_days ?? null,
    website: input.website ?? null,
    ein: input.ein ?? null,
    logo_path: input.logo_path ?? null,
    bank_name: input.bank_name ?? null,
    bank_account: input.bank_account ?? null,
    swift: input.swift ?? null,
    payment_terms: input.payment_terms ?? null,
    portal_contact_name: input.portal_contact_name ?? null,
    portal_email: input.portal_email ?? null,
    products: input.products ?? [],
    created_at: now(),
  };

  let { data, error } = await supabaseAdmin().from("partners").insert(row).select().single();

  if (error && /ein|swift|payment_terms/i.test(error.message)) {
    const retryRow = { ...row } as Record<string, unknown>;
    delete retryRow.ein;
    delete retryRow.swift;
    delete retryRow.payment_terms;
    const retry = await supabaseAdmin().from("partners").insert(retryRow).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`addPartner failed: ${error.message}`);
  return data as Partner;
}

export async function updatePartner(
  id: number,
  input: Partial<PartnerInput>
): Promise<Partner | undefined> {
  const updateObj: Record<string, unknown> = {};
  if (input.company !== undefined) updateObj.company = input.company;
  if (input.contact !== undefined) updateObj.contact = input.contact ?? null;
  if (input.email !== undefined) updateObj.email = input.email ?? null;
  if (input.phone !== undefined) updateObj.phone = input.phone ?? null;
  if (input.categories !== undefined) updateObj.categories = input.categories ?? null;
  if (input.location !== undefined) updateObj.location = input.location ?? null;
  if (input.preferred_channels !== undefined)
    updateObj.preferred_channels = input.preferred_channels ?? null;
  if (input.avg_delivery_days !== undefined)
    updateObj.avg_delivery_days = input.avg_delivery_days ?? null;
  if (input.website !== undefined) updateObj.website = input.website ?? null;
  if (input.ein !== undefined) updateObj.ein = input.ein ?? null;
  if (input.logo_path !== undefined) updateObj.logo_path = input.logo_path ?? null;
  if (input.bank_name !== undefined) updateObj.bank_name = input.bank_name ?? null;
  if (input.bank_account !== undefined) updateObj.bank_account = input.bank_account ?? null;
  if (input.swift !== undefined) updateObj.swift = input.swift ?? null;
  if (input.payment_terms !== undefined) updateObj.payment_terms = input.payment_terms ?? null;
  if (input.portal_contact_name !== undefined)
    updateObj.portal_contact_name = input.portal_contact_name ?? null;
  if (input.portal_email !== undefined) updateObj.portal_email = input.portal_email ?? null;
  if (input.products !== undefined) updateObj.products = input.products ?? [];

  if (!Object.keys(updateObj).length) {
    const { data, error } = await supabaseAdmin()
      .from("partners")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(`updatePartner failed: ${error.message}`);
    return (data ?? undefined) as Partner | undefined;
  }

  let { data, error } = await supabaseAdmin()
    .from("partners")
    .update(updateObj)
    .eq("id", id)
    .select()
    .maybeSingle();

  // If optional columns aren't migrated yet, retry without them so the rest still saves.
  if (error && /ein|swift|payment_terms/i.test(error.message)) {
    const retryObj = { ...updateObj };
    delete retryObj.ein;
    delete retryObj.swift;
    delete retryObj.payment_terms;
    const retry = await supabaseAdmin()
      .from("partners")
      .update(retryObj)
      .eq("id", id)
      .select()
      .maybeSingle();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`updatePartner failed: ${error.message}`);
  return (data ?? undefined) as Partner | undefined;
}

export async function partnerHasHistory(id: number): Promise<boolean> {
  const { data } = await supabaseAdmin()
    .from("dispatches")
    .select("id")
    .eq("partner_id", id)
    .limit(1);
  return (data?.length ?? 0) > 0;
}

export async function deletePartner(
  id: number
): Promise<{ ok: true } | { ok: false; reason: "has_history" }> {
  if (await partnerHasHistory(id)) return { ok: false, reason: "has_history" };
  await supabaseAdmin().from("partners").delete().eq("id", id);
  return { ok: true };
}

export async function setPartnerActive(id: number, active: boolean): Promise<void> {
  await supabaseAdmin()
    .from("partners")
    .update({ active: active ? 1 : 0 })
    .eq("id", id);
}

export function inviteMessageFor(p: Partner): {
  channels: string[];
  to: string;
  subject: string;
  body: string;
} {
  const channels =
    p.preferred_channels && p.preferred_channels.trim()
      ? p.preferred_channels
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean)
      : ["email"];

  const to = p.portal_email || p.email || p.company;
  const addressee = p.portal_contact_name || p.contact || p.company;

  return {
    channels,
    to,
    subject: "You've been invited to SupplyHUB",
    body: `Hi ${addressee}, ${p.company} has been added to SupplyHUB. You can now receive quote requests and submit offers through the partner portal.`,
  };
}
