"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { now } from "@/lib/util";
import { notify } from "@/lib/notify";
import { partnerById, recentQuotesForProduct, type PreviousProductQuote } from "@/lib/data";
import { getActor, createPendingSession, createSession, destroySession, SESSION_COOKIE } from "@/lib/session";
import { lookupActor, generateCode, hashCode, sendOtpSms } from "@/lib/otp";
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
import { getSettings, upsertSettings } from "@/lib/settings";
import {
  DEFAULT_SMS_NEW_REQUEST,
  DEFAULT_SMS_WON,
  DEFAULT_SMS_UPDATE,
  fillTemplate,
  partnerRequestLink,
} from "@/lib/notifyTemplates";
import {
  addPartner,
  updatePartner as libUpdatePartner,
  deletePartner as libDeletePartner,
  setPartnerActive,
  inviteMessageFor,
  type PartnerInput,
} from "@/lib/partners";

const COOKIE = "shub_actor";

// ---------- OTP Auth ----------

export async function requestOtp(formData: FormData) {
  const identifier = (formData.get("identifier") as string | null)?.trim() || "";
  if (!identifier) redirect("/login?error=required");

  const settings = await getSettings();
  const companyName = settings.company_name?.trim() || "SupplyerHUB";

  const actor = await lookupActor(identifier);
  if (!actor) redirect("/login?error=not_found");

  if (!actor.phone) redirect("/login?error=no_phone");

  const code = generateCode();
  const hash = hashCode(code);
  await createPendingSession(
    actor.type,
    actor.type === "partner" ? actor.id : null,
    hash
  );

  await sendOtpSms(actor.phone, code, companyName);

  const masked = actor.phone.slice(-4);
  redirect(`/login/verify?to=${encodeURIComponent("•••• " + masked)}`);
}

export async function verifyOtp(formData: FormData) {
  const code = (formData.get("code") as string | null)?.trim().replace(/\s/g, "") || "";
  if (!code || code.length !== 6) redirect("/login/verify?error=invalid");

  const sessionId = cookies().get(SESSION_COOKIE)?.value;
  if (!sessionId) redirect("/login?error=expired");

  const sb = supabaseAdmin();
  const { data: session } = await sb
    .from("auth_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("verified", false)
    .maybeSingle();

  if (!session) redirect("/login?error=expired");

  const expired = new Date(session.otp_expires as string).getTime() < Date.now();
  if (expired) {
    await sb.from("auth_sessions").delete().eq("id", sessionId);
    redirect("/login?error=expired");
  }

  const inputHash = hashCode(code);
  if (inputHash !== session.otp_hash) redirect("/login/verify?error=wrong");

  // Mark session as verified
  await sb
    .from("auth_sessions")
    .update({ verified: true, otp_hash: null, otp_expires: null, last_active: new Date().toISOString() })
    .eq("id", sessionId);

  if (session.actor_type === "manager") redirect("/manager");
  redirect("/partner");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

// ---------- Role switching ----------
export async function setActor(formData: FormData) {
  const actor = String(formData.get("actor") || "");
  cookies().set(COOKIE, actor, { path: "/", httpOnly: true, sameSite: "lax" });
  if (actor === "manager") redirect("/manager");
  if (actor.startsWith("partner:")) redirect("/partner");
  redirect("/");
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
  if (!category) redirect("/manager/requests/new?error=product");
  if (!quantity) redirect("/manager/requests/new?error=quantity");
  if (!partnerIds.length) redirect("/manager/requests/new?error=partners");
  const finalTitle = title || `${quantity.toLocaleString()} × ${category}`;

  // client_id is optional — null avoids FK failures from a fake id 0
  const { data: order } = await sb
    .from("orders")
    .insert({
      client_id: null,
      order_number: orderNumber || `ORD-${Date.now()}`,
      notes: null,
      created_at: now(),
    })
    .select("id")
    .single();
  if (!order) redirect("/manager/requests/new?error=save");
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
  if (!req) redirect("/manager/requests/new?error=save");
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

  const settings = await getSettings();
  const companyName = settings.company_name?.trim() || "our print house";
  const newRequestTemplate =
    settings.sms_new_request_template?.trim() || DEFAULT_SMS_NEW_REQUEST;

  for (const pid of partnerIds) {
    await sb.from("dispatches").insert({
      request_id: reqId,
      partner_id: pid,
      sent_at: now(),
    });
    const p = await partnerById(pid);
    if (!p) continue;
    const link = partnerRequestLink({
      portalToken: p.portal_token,
      requestId: reqId,
    });
    const body = fillTemplate(newRequestTemplate, {
      company_name: companyName,
      partner_name: p.company,
      title: finalTitle,
      quantity: quantity?.toLocaleString() ?? "",
      needed_by: neededBy || "soon",
      link,
    });
    await notify({
      to: `${p.email || p.company} / ${p.phone || ""}`,
      phone: p.phone,
      channels: ["email", "sms"],
      subject: `New order request from ${companyName} (SupplyHUB)`,
      body,
    });
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
  redirect(`/manager/requests/${id}?saved=1&notify=1`);
}

// ---------- Manager: notify all dispatched partners about a request update ----------
export async function notifyPartnersUpdate(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const sb = supabaseAdmin();
  const requestId = Number(formData.get("request_id"));
  const messageOverride = (formData.get("message") as string | null)?.trim() || null;

  const { data: reqRow } = await sb
    .from("product_requests")
    .select("title, quantity, needed_by")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) return;

  const settings = await getSettings();
  const companyName = settings.company_name?.trim() || "our print house";
  const template = messageOverride || settings.sms_update_template?.trim() || DEFAULT_SMS_UPDATE;

  const { data: dispatches } = await sb
    .from("dispatches")
    .select("partner_id")
    .eq("request_id", requestId);

  for (const d of dispatches ?? []) {
    const p = await partnerById(d.partner_id as number);
    if (!p) continue;
    const link = partnerRequestLink({ portalToken: p.portal_token, requestId });
    const body = fillTemplate(template, {
      company_name: companyName,
      partner_name: p.company,
      title: reqRow.title,
      quantity: reqRow.quantity != null ? Number(reqRow.quantity).toLocaleString() : "",
      needed_by: reqRow.needed_by || "",
      link,
    });
    await notify({
      to: `${p.email || p.company} / ${p.phone || ""}`,
      phone: p.phone,
      channels: ["sms"],
      subject: `Request updated — ${reqRow.title}`,
      body,
    });
  }

  revalidatePath(`/manager/requests/${requestId}`);
  redirect(`/manager/requests/${requestId}?saved=1`);
}

// ---------- Manager: send an existing request to more partners ----------
export async function dispatchToPartners(formData: FormData) {
  const sb = supabaseAdmin();
  const requestId = Number(formData.get("request_id"));
  const partnerIds = formData.getAll("partners").map((v) => Number(v));

  const { data: reqRow } = await sb
    .from("product_requests")
    .select("title, quantity, needed_by, status")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) redirect("/manager");

  const { data: existing } = await sb
    .from("dispatches")
    .select("partner_id")
    .eq("request_id", requestId);
  const alreadySent = new Set((existing ?? []).map((d) => d.partner_id as number));

  const settings = await getSettings();
  const companyName = settings.company_name?.trim() || "our print house";
  const newRequestTemplate =
    settings.sms_new_request_template?.trim() || DEFAULT_SMS_NEW_REQUEST;

  for (const pid of partnerIds) {
    if (alreadySent.has(pid)) continue;
    await sb.from("dispatches").insert({
      request_id: requestId,
      partner_id: pid,
      sent_at: now(),
    });
    const p = await partnerById(pid);
    if (!p) continue;
    const link = partnerRequestLink({
      portalToken: p.portal_token,
      requestId,
    });
    const body = fillTemplate(newRequestTemplate, {
      company_name: companyName,
      partner_name: p.company,
      title: reqRow.title,
      quantity:
        reqRow.quantity != null ? Number(reqRow.quantity).toLocaleString() : "",
      needed_by: reqRow.needed_by || "soon",
      link,
    });
    await notify({
      to: `${p.email || p.company} / ${p.phone || ""}`,
      phone: p.phone,
      channels: ["email", "sms"],
      subject: `New order request from ${companyName} (SupplyHUB)`,
      body,
    });
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
    const settings = await getSettings();
    const companyName = settings.company_name?.trim() || "our print house";
    const wonTemplate = settings.sms_won_template?.trim() || DEFAULT_SMS_WON;

    const { data: requestRow } = await sb
      .from("product_requests")
      .select("title, quantity, needed_by")
      .eq("id", requestId)
      .maybeSingle();
    const { data: wonQuote } = await sb
      .from("quotes")
      .select("price, currency, lead_time_days")
      .eq("id", quoteId)
      .maybeSingle();

    const { data: quotes } = await sb
      .from("quotes")
      .select("id, dispatch_id, status")
      .in("dispatch_id", dispatchIds);
    const partnerIds = [...new Set((dispatches ?? []).map((d) => d.partner_id as number))];
    const { data: partners } = partnerIds.length
      ? await sb
          .from("partners")
          .select("id, company, email, phone, portal_token")
          .in("id", partnerIds)
      : { data: [] };
    const partnersMap = Object.fromEntries((partners ?? []).map((p) => [p.id, p]));
    const dispatchToPartner = Object.fromEntries(
      (dispatches ?? []).map((d) => [d.id, d.partner_id as number])
    );
    for (const q of quotes ?? []) {
      const pid = dispatchToPartner[q.dispatch_id];
      const p = partnersMap[pid] as
        | {
            company: string;
            email: string | null;
            phone: string | null;
            portal_token: string | null;
          }
        | undefined;
      if (!p) continue;
      if (q.status === "won") {
        const link = partnerRequestLink({
          portalToken: p.portal_token,
          requestId,
        });
        const body = fillTemplate(wonTemplate, {
          company_name: companyName,
          partner_name: p.company,
          title: requestRow?.title ?? `Request #${requestId}`,
          quantity:
            requestRow?.quantity != null
              ? Number(requestRow.quantity).toLocaleString()
              : "",
          price:
            wonQuote?.price != null
              ? Number(wonQuote.price).toLocaleString()
              : "",
          currency: wonQuote?.currency || "USD",
          lead_time_days: wonQuote?.lead_time_days ?? "",
          needed_by: requestRow?.needed_by || "—",
          link,
        });
        await notify({
          to: `${p.email} / ${p.phone}`,
          phone: p.phone,
          channels: ["email", "sms"],
          subject: `You won the project from ${companyName} (SupplyHUB)`,
          body,
        });
      } else {
        await notify({
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

// ---------- Partner: mark request as seen (first open) ----------
export async function markRequestSeen(formData: FormData) {
  const partnerId = Number(formData.get("partner_id"));
  const requestId = Number(formData.get("request_id"));
  if (!partnerId || !requestId) return;

  const sb = supabaseAdmin();
  // Only stamp if not yet seen
  await sb
    .from("dispatches")
    .update({ seen_at: new Date().toISOString() })
    .eq("partner_id", partnerId)
    .eq("request_id", requestId)
    .is("seen_at", null);
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
    sms_new_request_template: str("sms_new_request_template"),
    sms_won_template: str("sms_won_template"),
    sms_update_template: str("sms_update_template"),
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

// ---------- Manager: send reminder to non-responding partners ----------
export async function sendReminder(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const requestId = Number(formData.get("request_id"));
  const sb = supabaseAdmin();

  const { data: reqRow } = await sb
    .from("product_requests")
    .select("title, quantity, needed_by")
    .eq("id", requestId)
    .maybeSingle();
  if (!reqRow) redirect("/manager");

  // Find dispatches with no quote yet
  const { data: dispatches } = await sb
    .from("dispatches")
    .select("id, partner_id")
    .eq("request_id", requestId);
  if (!dispatches?.length) redirect("/manager");

  const dispatchIds = dispatches.map((d) => d.id as number);
  const { data: existingQuotes } = await sb
    .from("quotes")
    .select("dispatch_id")
    .in("dispatch_id", dispatchIds);
  const quotedDispatchIds = new Set((existingQuotes ?? []).map((q) => q.dispatch_id as number));

  const settings = await getSettings();
  const companyName = settings.company_name?.trim() || "our print house";

  let reminded = 0;
  for (const d of dispatches) {
    if (quotedDispatchIds.has(d.id)) continue; // already quoted
    const p = await partnerById(d.partner_id);
    if (!p) continue;
    const link = partnerRequestLink({ portalToken: p.portal_token, requestId });
    const body = `Hi ${p.company}, this is a friendly reminder about our open request for "${reqRow.title}"${reqRow.quantity ? ` (qty: ${Number(reqRow.quantity).toLocaleString()})` : ""}${reqRow.needed_by ? `, needed by ${reqRow.needed_by}` : ""}. Please submit your quote: ${link} — Thanks, ${companyName}`;
    await notify({
      to: `${p.email || p.company} / ${p.phone || ""}`,
      phone: p.phone,
      channels: ["email", "sms"],
      subject: `Reminder: quote requested for "${reqRow.title}"`,
      body,
    });
    // Log reminder as a manager message in the thread
    await sb.from("messages").insert({
      request_id: requestId,
      partner_id: d.partner_id,
      author_role: "manager",
      text: `📩 Reminder sent to ${p.company} — awaiting quote.`,
      created_at: now(),
    });
    reminded++;
  }

  revalidatePath("/manager");
  revalidatePath(`/manager/requests/${requestId}`);
  redirect(`/manager?reminded=${reminded}`);
}

// ---------- Manager: quick status update ----------
export async function updateRequestStatus(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const id = Number(formData.get("id"));
  const status = String(formData.get("status") || "").trim();
  const allowed = ["draft", "sent", "quoting", "clarifying", "awarded", "closed"];

  if (!id || !allowed.includes(status)) redirect("/manager");

  await supabaseAdmin()
    .from("product_requests")
    .update({ status })
    .eq("id", id);

  revalidatePath("/manager");
  revalidatePath(`/manager/requests/${id}`);
}

// ---------- Manager: delete a request (only when no partners dispatched) ----------
export async function deleteRequest(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const id = Number(formData.get("id"));
  if (!id) redirect("/manager");

  const sb = supabaseAdmin();

  // Safety: refuse to delete if any dispatches exist
  const { count } = await sb
    .from("dispatches")
    .select("id", { count: "exact", head: true })
    .eq("request_id", id);

  if ((count ?? 0) > 0) {
    redirect("/manager?error=has_dispatches");
  }

  await sb.from("product_requests").delete().eq("id", id);
  revalidatePath("/manager");
  redirect("/manager");
}

// ---------- Manager: duplicate a request ----------
export async function duplicateRequest(formData: FormData) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const id = Number(formData.get("id"));
  const sb = supabaseAdmin();

  const { data: src } = await sb
    .from("product_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!src) redirect("/manager");

  const { data: newReq } = await sb
    .from("product_requests")
    .insert({
      order_id: src.order_id,
      title: `${src.title} (copy)`,
      category: src.category,
      specs: src.specs,
      quantity: src.quantity,
      needed_by: null, // clear date — manager should set a new one
      hide_client: src.hide_client,
      status: "draft",
      standard_size: src.standard_size,
      width: src.width,
      height: src.height,
      depth: src.depth,
      size_unit: src.size_unit,
      material: src.material,
      finishing: src.finishing,
      attachments: null, // don't copy attachments
      created_at: now(),
    })
    .select("id")
    .single();

  revalidatePath("/manager");
  redirect(`/manager/requests/${newReq!.id}`);
}
