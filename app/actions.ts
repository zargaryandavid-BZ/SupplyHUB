"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { now } from "@/lib/util";
import { notify } from "@/lib/notify";
import { partnerById, recentQuotesForProduct, type PreviousProductQuote } from "@/lib/data";
import { getActor } from "@/lib/session";
import type { PartnerProduct } from "@/lib/types";
import {
  uploadLogo,
  uploadCompanyLogo,
  uploadAttachment,
  uploadProductImage,
  removeLogo,
  removeAttachment,
  LOGO_ALLOWED_TYPES,
  LOGO_MAX_BYTES,
  PRODUCT_IMAGE_ALLOWED_TYPES,
  PRODUCT_IMAGE_MAX_BYTES,
} from "@/lib/storage";
import { upsertSettings } from "@/lib/settings";
import {
  addPartner,
  updatePartner as libUpdatePartner,
  deletePartner as libDeletePartner,
  setPartnerActive,
  inviteMessageFor,
  type PartnerInput,
} from "@/lib/partners";

const COOKIE = "shub_actor";

// ---------- Role switching ----------
export async function setActor(formData: FormData) {
  const actor = String(formData.get("actor") || "");
  cookies().set(COOKIE, actor, { path: "/", httpOnly: true, sameSite: "lax" });
  if (actor === "manager") redirect("/manager");
  if (actor.startsWith("partner:")) redirect("/partner");
  redirect("/");
}

async function notifyPartner(pid: number, subject: string, body: string) {
  const p = await partnerById(pid);
  if (p) {
    notify({
      to: `${p.email || p.company} / ${p.phone || ""}`,
      channels: ["email", "sms"],
      subject,
      body,
    });
  }
}

/** Last quotes per partner for a product (used on new-request form). */
export async function getRecentQuotesForProduct(
  productName: string
): Promise<PreviousProductQuote[]> {
  const actor = await getActor();
  if (actor.role !== "manager") return [];
  return recentQuotesForProduct(productName, 5);
}

// ---------- Manager: create + dispatch a request ----------
export async function createRequest(formData: FormData) {
  const sb = supabaseAdmin();
  const orderNumber = String(formData.get("order_number") || "").trim();
  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const specs = String(formData.get("specs") || "").trim();
  const quantity = Number(formData.get("quantity")) || null;
  const neededBy = String(formData.get("needed_by") || "").trim() || null;
  const partnerIds = formData.getAll("partners").map((v) => Number(v));

  const standardSize = String(formData.get("standard_size") || "").trim() || null;
  const width = Number(formData.get("width")) || null;
  const height = Number(formData.get("height")) || null;
  const depth = Number(formData.get("depth")) || null;
  const sizeUnit = String(formData.get("size_unit") || "mm").trim();
  const material = String(formData.get("material") || "").trim() || null;
  const finishingValues = formData.getAll("finishing").map(String).filter(Boolean);
  const finishing = finishingValues.length ? finishingValues.join(", ") : null;

  // Required: product (category) + quantity. Title is optional — derive it if blank.
  if (!category || !quantity) redirect("/manager/requests/new?error=1");
  const finalTitle = title || `${quantity ? quantity.toLocaleString() + " × " : ""}${category}`;

  const { data: order } = await sb
    .from("orders")
    .insert({
      client_id: 0,
      order_number: orderNumber || `ORD-${Date.now()}`,
      notes: null,
      created_at: now(),
    })
    .select("id")
    .single();
  if (!order) redirect("/manager/requests/new?error=1");
  const orderId = order.id as number;

  // Save uploaded files before inserting the request row
  const { data: req } = await sb
    .from("product_requests")
    .insert({
      order_id: orderId,
      title: finalTitle,
      category,
      specs: specs || null,
      quantity,
      needed_by: neededBy,
      hide_client: 1,
      status: partnerIds.length ? "sent" : "draft",
      created_at: now(),
      standard_size: standardSize,
      width,
      height,
      depth,
      size_unit: sizeUnit,
      material,
      finishing,
      attachments: null,
    })
    .select("id")
    .single();
  if (!req) redirect("/manager/requests/new?error=1");
  const reqId = req.id as number;

  // Save attachment files now that we have the request ID
  const attachmentFiles = formData.getAll("attachments") as File[];
  const savedKeys: string[] = [];
  for (const file of attachmentFiles) {
    if (!file || !file.size) continue;
    const key = await uploadAttachment(file, reqId);
    savedKeys.push(key);
  }
  if (savedKeys.length) {
    await sb
      .from("product_requests")
      .update({ attachments: JSON.stringify(savedKeys) })
      .eq("id", reqId);
  }

  for (const pid of partnerIds) {
    await sb.from("dispatches").insert({
      request_id: reqId,
      partner_id: pid,
      sent_at: now(),
    });
    await notifyPartner(
      pid,
      `New quote request: ${title}`,
      `Please submit your price and lead time by ${neededBy || "soon"}.`
    );
  }

  revalidatePath("/manager");
  redirect(`/manager/requests/${reqId}`);
}

// ---------- Manager: update a request anytime ----------
export async function updateRequest(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const sb = supabaseAdmin();
  const id = Number(formData.get("id"));
  if (!id) redirect("/manager");

  const { data: existing } = await sb
    .from("product_requests")
    .select("id, order_id, attachments")
    .eq("id", id)
    .maybeSingle();
  if (!existing) redirect("/manager");

  const title = String(formData.get("title") || "").trim();
  const category = String(formData.get("category") || "").trim();
  const specs = String(formData.get("specs") || "").trim() || null;
  const quantity = Number(formData.get("quantity")) || null;
  const neededBy = String(formData.get("needed_by") || "").trim() || null;
  const orderNumber = String(formData.get("order_number") || "").trim();
  const standardSize = String(formData.get("standard_size") || "").trim() || null;
  const width = Number(formData.get("width")) || null;
  const height = Number(formData.get("height")) || null;
  const depth = Number(formData.get("depth")) || null;
  const sizeUnit = String(formData.get("size_unit") || "mm").trim() || null;
  const material = String(formData.get("material") || "").trim() || null;
  const finishingValues = formData.getAll("finishing").map(String).filter(Boolean);
  const finishing = finishingValues.length ? finishingValues.join(", ") : null;

  if (!category || !quantity) {
    redirect(`/manager/requests/${id}?error=1`);
  }
  const finalTitle = title || `${quantity.toLocaleString()} × ${category}`;

  // Keep selected existing attachments; drop (and delete) the rest.
  const keepKeys = formData.getAll("keep_attachments").map(String).filter(Boolean);
  let prevKeys: string[] = [];
  try {
    prevKeys = existing.attachments ? JSON.parse(existing.attachments as string) : [];
    if (!Array.isArray(prevKeys)) prevKeys = [];
  } catch {
    prevKeys = [];
  }
  const removed = prevKeys.filter((k) => !keepKeys.includes(k));
  for (const key of removed) {
    try {
      await removeAttachment(key);
    } catch {
      /* best-effort cleanup */
    }
  }

  const newFiles = formData.getAll("attachments") as File[];
  const newKeys: string[] = [];
  for (const file of newFiles) {
    if (!file || !file.size) continue;
    newKeys.push(await uploadAttachment(file, id));
  }
  const attachments = [...keepKeys, ...newKeys];

  await sb
    .from("product_requests")
    .update({
      title: finalTitle,
      category,
      specs,
      quantity,
      needed_by: neededBy,
      standard_size: standardSize,
      width,
      height,
      depth,
      size_unit: sizeUnit,
      material,
      finishing,
      attachments: attachments.length ? JSON.stringify(attachments) : null,
    })
    .eq("id", id);

  if (orderNumber && existing.order_id) {
    await sb
      .from("orders")
      .update({ order_number: orderNumber })
      .eq("id", existing.order_id);
  }

  revalidatePath("/manager");
  revalidatePath(`/manager/requests/${id}`);
  redirect(`/manager/requests/${id}?saved=1`);
}

// ---------- Manager: send an existing request to more partners ----------
export async function dispatchToPartners(formData: FormData) {
  const sb = supabaseAdmin();
  const requestId = Number(formData.get("request_id"));
  const partnerIds = formData.getAll("partners").map((v) => Number(v));

  const { data: reqRow } = await sb
    .from("product_requests")
    .select("title, needed_by, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) redirect("/manager");

  const { data: existing } = await sb
    .from("dispatches")
    .select("partner_id")
    .eq("request_id", requestId);
  const alreadySent = new Set((existing ?? []).map((d) => d.partner_id as number));

  for (const pid of partnerIds) {
    if (alreadySent.has(pid)) continue;
    await sb.from("dispatches").insert({
      request_id: requestId,
      partner_id: pid,
      sent_at: now(),
    });
    await notifyPartner(
      pid,
      `New quote request: ${reqRow.title}`,
      `Please submit your price and lead time by ${reqRow.needed_by || "soon"}.`
    );
  }

  if (reqRow.status === "draft" && partnerIds.length) {
    await sb.from("product_requests").update({ status: "sent" }).eq("id", requestId);
  }

  revalidatePath(`/manager/requests/${requestId}`);
  redirect(`/manager/requests/${requestId}`);
}

// ---------- Partner: submit or revise a quote ----------
export async function submitQuote(formData: FormData) {
  const sb = supabaseAdmin();
  const dispatchId = Number(formData.get("dispatch_id"));
  const requestId = Number(formData.get("request_id"));
  const price = Number(formData.get("price")) || null;
  const currency = String(formData.get("currency") || "USD");
  const leadTime = Number(formData.get("lead_time_days")) || null;
  const validUntil = String(formData.get("valid_until") || "").trim() || null;
  const conditions = String(formData.get("conditions") || "").trim();

  const { data: existing } = await sb
    .from("quotes")
    .select("id, revision")
    .eq("dispatch_id", dispatchId)
    .maybeSingle();

  if (existing) {
    await sb
      .from("quotes")
      .update({
        price,
        currency,
        lead_time_days: leadTime,
        valid_until: validUntil,
        conditions,
        revision: existing.revision + 1,
        status: "submitted",
        created_at: now(),
      })
      .eq("id", existing.id);
  } else {
    await sb.from("quotes").insert({
      dispatch_id: dispatchId,
      price,
      currency,
      lead_time_days: leadTime,
      valid_until: validUntil,
      conditions,
      status: "submitted",
      revision: 1,
      created_at: now(),
    });
  }

  const { data: reqRow } = await sb
    .from("product_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();
  if (reqRow && (reqRow.status === "sent" || reqRow.status === "draft")) {
    await sb.from("product_requests").update({ status: "quoting" }).eq("id", requestId);
  }

  notify({
    to: "Distribution Manager",
    channels: ["email"],
    subject: `Quote received for request #${requestId}`,
    body: `A partner submitted ${currency} ${price ?? "?"} (${leadTime ?? "?"} days).`,
  });

  revalidatePath(`/partner/requests/${requestId}`);
  redirect(`/partner/requests/${requestId}?saved=1`);
}

// ---------- Manager: award a quote ----------
export async function awardQuote(formData: FormData) {
  const sb = supabaseAdmin();
  const quoteId = Number(formData.get("quote_id"));
  const requestId = Number(formData.get("request_id"));

  const { data: dispatches } = await sb
    .from("dispatches")
    .select("id, partner_id")
    .eq("request_id", requestId);
  const dispatchIds = (dispatches ?? []).map((d) => d.id as number);

  // Mark winner and losers
  await sb.from("quotes").update({ status: "won" }).eq("id", quoteId);
  if (dispatchIds.length) {
    await sb
      .from("quotes")
      .update({ status: "lost" })
      .in("dispatch_id", dispatchIds)
      .neq("id", quoteId);
  }
  await sb.from("product_requests").update({ status: "awarded" }).eq("id", requestId);

  // Notify partners — batch-fetch to avoid N+1
  if (dispatchIds.length) {
    const { data: quotes } = await sb
      .from("quotes")
      .select("id, dispatch_id, status")
      .in("dispatch_id", dispatchIds);
    const partnerIds = [...new Set((dispatches ?? []).map((d) => d.partner_id as number))];
    const { data: partners } = partnerIds.length
      ? await sb.from("partners").select("id, company, email, phone").in("id", partnerIds)
      : { data: [] };
    const partnersMap = Object.fromEntries((partners ?? []).map((p) => [p.id, p]));
    const dispatchToPartner = Object.fromEntries(
      (dispatches ?? []).map((d) => [d.id, d.partner_id as number])
    );
    for (const q of quotes ?? []) {
      const pid = dispatchToPartner[q.dispatch_id];
      const p = partnersMap[pid] as { company: string; email: string | null; phone: string | null } | undefined;
      if (!p) continue;
      if (q.status === "won") {
        notify({
          to: `${p.email} / ${p.phone}`,
          channels: ["email", "sms"],
          subject: "You won this order!",
          body: `Congratulations ${p.company}, your quote was selected.`,
        });
      } else {
        notify({
          to: p.email || p.company,
          channels: ["email"],
          subject: "Order awarded to another partner",
          body: `Thank you ${p.company}. This time another partner was selected.`,
        });
      }
    }
  }

  revalidatePath(`/manager/requests/${requestId}`);
  redirect(`/manager/requests/${requestId}`);
}

// ---------- Messages / questions ----------
export async function postMessage(formData: FormData) {
  const sb = supabaseAdmin();
  const requestId = Number(formData.get("request_id"));
  const partnerId = formData.get("partner_id") ? Number(formData.get("partner_id")) : null;
  const authorRole = String(formData.get("author_role") || "manager");
  const text = String(formData.get("text") || "").trim();
  const backTo = String(formData.get("back_to") || `/manager/requests/${requestId}`);
  if (!text) redirect(backTo);

  await sb.from("messages").insert({
    request_id: requestId,
    partner_id: partnerId,
    author_role: authorRole,
    text,
    created_at: now(),
  });

  if (authorRole === "partner") {
    const { data: reqRow } = await sb
      .from("product_requests")
      .select("status")
      .eq("id", requestId)
      .maybeSingle();
    if (reqRow && (reqRow.status === "sent" || reqRow.status === "quoting")) {
      await sb.from("product_requests").update({ status: "clarifying" }).eq("id", requestId);
    }
  }

  notify({
    to: authorRole === "partner" ? "Distribution Manager" : "Partner",
    channels: ["email", "sms"],
    subject: `New message on request #${requestId}`,
    body: text.slice(0, 120),
  });

  revalidatePath(backTo);
  redirect(backTo);
}

// ---------- Logo validation constants (re-exported from storage.ts for redirect errors) ----------

function str(fd: FormData, key: string): string {
  return String(fd.get(key) || "").trim();
}

function num(v: unknown): number | null {
  if (v === "" || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parses the "products" hidden JSON (name/moq/delivery/price/currency + kept image keys)
 * and merges in any newly-uploaded image files (fields named product_image_<row>_<slot>).
 * Row indices must line up with PartnerProducts' unfiltered `rows` state on the client.
 */
async function parseProductsWithImages(
  formData: FormData,
  partnerId: number
): Promise<PartnerProduct[]> {
  let raw: unknown[];
  try {
    const parsed = JSON.parse(String(formData.get("products") || "[]"));
    raw = Array.isArray(parsed) ? parsed : [];
  } catch {
    raw = [];
  }

  const results: PartnerProduct[] = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i] as Record<string, unknown>;
    const name = String(p?.name || "").trim();
    const keptImages: string[] = Array.isArray(p?.images)
      ? (p.images as unknown[]).map((u) => String(u || "").trim())
      : [];

    const images: string[] = [];
    for (let k = 0; k < 3; k++) {
      const file = formData.get(`product_image_${i}_${k}`) as File | null;
      if (file && file.size > 0) {
        if (!PRODUCT_IMAGE_ALLOWED_TYPES.includes(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES) {
          continue; // skip invalid uploads rather than failing the whole save
        }
        images.push(await uploadProductImage(file, partnerId));
      } else if (keptImages[k]) {
        images.push(keptImages[k]);
      }
    }

    if (!name) continue;
    const notes = String(p?.notes || "").trim();
    results.push({
      name,
      ...(notes ? { notes } : {}),
      moq: num(p?.moq),
      delivery_days: num(p?.delivery_days),
      price: num(p?.price),
      currency: String(p?.currency || "USD"),
      images,
    });
  }
  return results;
}

function parsePartnerInput(formData: FormData): PartnerInput {
  const channels = formData
    .getAll("preferred_channels")
    .map((v) => String(v))
    .filter(Boolean);
  return {
    company: str(formData, "company"),
    contact: [str(formData, "contact_first"), str(formData, "contact_last")].filter(Boolean).join(" ") || null,
    email: str(formData, "email") || null,
    phone: str(formData, "phone") || null,
    location: str(formData, "location") || null,
    preferred_channels: channels.length ? channels.join(",") : null,
    avg_delivery_days: Number(formData.get("avg_delivery_days")) || null,
    website: str(formData, "website") || null,
    ein: str(formData, "ein") || null,
    bank_name: str(formData, "bank_name") || null,
    bank_account: str(formData, "bank_account") || null,
    swift: str(formData, "swift") || null,
    payment_terms: str(formData, "payment_terms") || null,
    portal_contact_name:
      [str(formData, "portal_contact_first"), str(formData, "portal_contact_last")].filter(Boolean).join(" ") || null,
    portal_email: str(formData, "portal_email") || null,
  };
}

// ---------- Manager: add a partner ----------
export async function createPartner(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const company = str(formData, "company");
  if (!company) redirect("/manager/partners/new?error=1");

  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    if (!LOGO_ALLOWED_TYPES.includes(logoFile.type) || logoFile.size > LOGO_MAX_BYTES) {
      redirect("/manager/partners/new?error=logo");
    }
  }

  const input = parsePartnerInput(formData);
  let partner;
  try {
    partner = await addPartner(input);
  } catch (err) {
    console.error("[createPartner]", err);
    redirect("/manager/partners/new?error=save");
  }

  if (logoFile && logoFile.size > 0) {
    const logoKey = await uploadLogo(logoFile, partner.id, null);
    await libUpdatePartner(partner.id, { logo_path: logoKey });
    partner.logo_path = logoKey;
  }

  const products = await parseProductsWithImages(formData, partner.id);
  if (products.length) {
    await libUpdatePartner(partner.id, { products });
    partner.products = products;
  }

  const invite = inviteMessageFor(partner);
  if (invite.to) {
    notify({
      to: invite.to,
      channels: invite.channels as ["email"],
      subject: invite.subject,
      body: invite.body,
    });
  }

  revalidatePath("/manager/partners");
  redirect("/manager/partners");
}

// ---------- Manager: update a partner ----------
export async function updatePartner(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const id = Number(formData.get("id"));
  if (!id) redirect("/manager/partners");

  const company = str(formData, "company");
  if (!company) redirect(`/manager/partners/${id}/edit?error=1`);

  const logoFile = formData.get("logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    if (!LOGO_ALLOWED_TYPES.includes(logoFile.type) || logoFile.size > LOGO_MAX_BYTES) {
      redirect(`/manager/partners/${id}/edit?error=logo`);
    }
  }

  const input = parsePartnerInput(formData);

  if (logoFile && logoFile.size > 0) {
    const existing = await partnerById(id);
    const oldKey = existing?.logo_path ?? null;
    input.logo_path = await uploadLogo(logoFile, id, oldKey);
  }

  input.products = await parseProductsWithImages(formData, id);

  try {
    await libUpdatePartner(id, input);
  } catch (err) {
    console.error("[updatePartner]", err);
    redirect(`/manager/partners/${id}/edit?error=save`);
  }

  revalidatePath("/manager/partners");
  revalidatePath(`/manager/partners/${id}/edit`);
  redirect(`/manager/partners/${id}/edit?saved=1`);
}

// ---------- Manager: delete a partner ----------
export async function deletePartner(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const id = Number(formData.get("id"));
  const result = await libDeletePartner(id);
  if (!result.ok) {
    redirect(`/manager/partners/${id}/edit?error=has_history`);
  }
  revalidatePath("/manager/partners");
  redirect("/manager/partners");
}

// ---------- Manager: generate / regenerate a partner portal token ----------
export async function generatePortalToken(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const id = Number(formData.get("id"));
  const token = crypto.randomUUID();
  await supabaseAdmin()
    .from("partners")
    .update({ portal_token: token })
    .eq("id", id);
  revalidatePath(`/manager/partners/${id}/edit`);
  redirect(`/manager/partners/${id}/edit?saved=1`);
}

// ---------- Manager: save company settings ----------
export async function saveSettings(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const str = (k: string) => (formData.get(k) as string | null)?.trim() || null;

  const values: Parameters<typeof upsertSettings>[0] = {
    company_name: str("company_name"),
    hq_address: str("hq_address"),
    branches: str("branches"),
    ci_number: str("ci_number"),
    ein: str("ein"),
    bank_name: str("bank_name"),
    bank_account: str("bank_account"),
    swift: str("swift"),
    payment_terms: str("payment_terms"),
    manager_name: str("manager_name"),
    manager_phone: str("manager_phone"),
    manager_email: str("manager_email"),
    contact_name: str("contact_name"),
    contact_phone: str("contact_phone"),
    contact_email: str("contact_email"),
  };

  const logoFile = formData.get("company_logo") as File | null;
  if (logoFile && logoFile.size > 0) {
    if (!LOGO_ALLOWED_TYPES.includes(logoFile.type) || logoFile.size > LOGO_MAX_BYTES) {
      redirect("/manager/settings?error=logo");
    }
    const oldKey = str("current_logo_path");
    values.logo_path = await uploadCompanyLogo(logoFile, oldKey);
  }

  await upsertSettings(values);

  revalidatePath("/manager/settings");
  redirect("/manager/settings?saved=1");
}

// ---------- Manager: save order feedback ----------
export async function saveFeedback(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const dispatchId = Number(formData.get("dispatch_id"));
  const partnerId = Number(formData.get("partner_id"));
  const requestId = Number(formData.get("request_id"));

  const rating = (key: string) => {
    const v = Number(formData.get(key));
    return v >= 1 && v <= 5 ? v : null;
  };

  const payload = {
    dispatch_id: dispatchId,
    partner_id: partnerId,
    request_id: requestId,
    quality_rating: rating("quality_rating"),
    quantity_rating: rating("quantity_rating"),
    satisfaction_rating: rating("satisfaction_rating"),
    timing_rating: rating("timing_rating"),
    notes: (formData.get("notes") as string | null)?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  const sb = supabaseAdmin();
  const { error } = await sb
    .from("partner_feedback")
    .upsert(payload, { onConflict: "dispatch_id" });

  if (error) {
    console.error("saveFeedback error:", error.message);
    redirect("/manager/partners?error=feedback");
  }

  revalidatePath("/manager/partners");
}

// ---------- Manager: toggle partner active/inactive ----------
export async function togglePartnerActive(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const id = Number(formData.get("id"));
  const active = formData.get("active") === "1";
  await setPartnerActive(id, active);
  revalidatePath("/manager/partners");
  revalidatePath(`/manager/partners/${id}/edit`);
  redirect("/manager/partners");
}
