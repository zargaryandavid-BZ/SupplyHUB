import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { getActor } from "@/lib/session";
import { requestDetail, activePartners } from "@/lib/data";
import { awardQuote, postMessage, dispatchToPartners, updateRequest, notifyPartnersUpdate } from "@/app/actions";
import { getSettings } from "@/lib/settings";
import { DEFAULT_SMS_UPDATE, fillTemplate, partnerRequestLink } from "@/lib/notifyTemplates";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/Badge";
import { RequestDetailsPanel } from "@/components/RequestDetailsPanel";
import { NotifyPartnersModal } from "@/components/NotifyPartnersModal";
import { QuoteOfferList } from "@/components/QuoteOfferList";
import { signedAttachmentUrl, publicLogoUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function ManagerRequestDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string; error?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const [data, remaining, settings] = await Promise.all([
    requestDetail(Number(params.id)),
    activePartners(),
    getSettings(),
  ]);
  if (!data) notFound();
  const { request, offers, messages } = data;

  // Resolve attachment keys → signed URLs (private bucket, 1 h expiry)
  let attachmentUrls: { key: string; url: string; name: string }[] = [];
  if (request.attachments) {
    try {
      const keys: string[] = JSON.parse(request.attachments);
      attachmentUrls = await Promise.all(
        keys.map(async (key) => ({
          key,
          url: await signedAttachmentUrl(key),
          name: key.split("/").pop() ?? key,
        }))
      );
    } catch {
      /* malformed JSON — skip */
    }
  }

  // Build default SMS update message (filled with request data as preview)
  const companyName = settings.company_name?.trim() || "our print house";
  const logoUrl = publicLogoUrl(settings.logo_path);
  const updateTemplate = settings.sms_update_template?.trim() || DEFAULT_SMS_UPDATE;
  const defaultSmsMessage = fillTemplate(updateTemplate, {
    company_name: companyName,
    partner_name: "{{partner_name}}",
    title: request.title,
    quantity: request.quantity != null ? Number(request.quantity).toLocaleString() : "",
    needed_by: request.needed_by || "",
    link: partnerRequestLink({ portalToken: null, requestId: request.id }),
  });
  const dispatchedPartnerCount = offers.length;

  const prices = offers.filter((o) => o.price != null).map((o) => o.price as number);
  const leadTimes = offers
    .filter((o) => o.lead_time_days != null)
    .map((o) => o.lead_time_days as number);
  const bestPrice = prices.length ? Math.min(...prices) : null;
  const bestLead = leadTimes.length ? Math.min(...leadTimes) : null;
  const isAwarded = request.status === "awarded";

  const alreadySent = new Set(offers.map((o) => o.partner_id));
  const remainingPartners = remaining.filter((p) => !alreadySent.has(p.id));

  return (
    <div className="app">
      <Sidebar active="board" />
      <main className="main">
        <div className="page-head">
          <div>
            <h1>{request.title}</h1>
            <p>
              {request.client_name} · {request.order_number} · <Badge status={request.status} />
            </p>
          </div>
          <Link href="/manager" className="btn ghost">
            ← Back to board
          </Link>
        </div>

        {searchParams.saved === "1" && (
          <div className="notice">Request updated successfully.</div>
        )}
        {searchParams.error === "1" && (
          <div className="notice error">Product and quantity are required.</div>
        )}

        <div className="grid cols-2">
          <RequestDetailsPanel
            request={{
              id: request.id,
              title: request.title,
              category: request.category,
              specs: request.specs,
              quantity: request.quantity,
              needed_by: request.needed_by,
              client_name: request.client_name,
              client_contact: request.client_contact,
              order_number: request.order_number,
              standard_size: request.standard_size,
              width: request.width,
              height: request.height,
              depth: request.depth,
              size_unit: request.size_unit,
              material: request.material,
              finishing: request.finishing,
              sku_count: (request as typeof request & { sku_count?: number | null }).sku_count ?? null,
              sku_items: (request as typeof request & { sku_items?: string | null }).sku_items ?? null,
            }}
            attachments={attachmentUrls}
            updateAction={updateRequest}
          />

          <div className="card">
            <h3>Send to more partners</h3>
            {remainingPartners.length === 0 ? (
              <p className="small muted">All active partners have this request.</p>
            ) : (
              <form action={dispatchToPartners}>
                <input type="hidden" name="request_id" value={request.id} />
                <div className="checks" style={{ gridTemplateColumns: "1fr" }}>
                  {remainingPartners.map((p) => (
                    <label className="check" key={p.id}>
                      <input type="checkbox" name="partners" value={p.id} />
                      <span>
                        {p.company} <span className="small muted">· {p.categories}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <button className="btn sm" type="submit" style={{ marginTop: 10 }}>
                  Send request
                </button>
              </form>
            )}
          </div>
        </div>

        <h3 style={{ marginTop: 10 }}>
          Quotes ({offers.filter((o) => o.quote_id).length} of {offers.length} partners
          responded)
        </h3>
        <QuoteOfferList
          offers={offers.map((o) => ({
            dispatch_id: o.dispatch_id,
            partner_id: o.partner_id,
            company: o.company,
            rating: o.rating ?? null,
            seen_at: o.seen_at ?? null,
            quote_id: o.quote_id ?? null,
            quote_status: o.quote_status ?? null,
            price: o.price ?? null,
            currency: (o as typeof o & { currency?: string }).currency ?? "USD",
            lead_time_days: o.lead_time_days ?? null,
            valid_until: o.valid_until ?? null,
            conditions: o.conditions ?? null,
            revision: (o as typeof o & { revision?: number }).revision ?? 1,
          }))}
          requestId={request.id}
          requestTitle={request.title}
          bestPrice={bestPrice}
          bestLead={bestLead}
          isAwarded={isAwarded}
          awardAction={awardQuote}
          companyName={companyName}
          logoUrl={logoUrl}
        />

        <div className="card" style={{ marginTop: 20 }}>
          <h3>Questions &amp; comments</h3>
          {messages.length === 0 && <p className="small muted">No messages yet.</p>}
          <ul className="thread">
            {messages.map((m) => (
              <li key={m.id}>
                <span className={`who ${m.author_role}`}>
                  {m.author_role === "partner"
                    ? (m as typeof m & { company?: string | null }).company || "Partner"
                    : "You (Manager)"}
                </span>{" "}
                <span className="when">{m.created_at}</span>
                <div>{m.text}</div>
              </li>
            ))}
          </ul>
          <hr className="sep" />
          <form action={postMessage}>
            <input type="hidden" name="request_id" value={request.id} />
            <input type="hidden" name="author_role" value="manager" />
            <input type="hidden" name="back_to" value={`/manager/requests/${request.id}`} />
            <div className="field">
              <label>Reply to partners</label>
              <textarea name="text" placeholder="Answer a question or add a clarification…" />
            </div>
            <button className="btn sm" type="submit">
              Post message
            </button>
          </form>
        </div>
        <Suspense>
          <NotifyPartnersModal
            requestId={request.id}
            requestTitle={request.title}
            partnerCount={dispatchedPartnerCount}
            defaultMessage={defaultSmsMessage}
            notifyAction={notifyPartnersUpdate}
          />
        </Suspense>
      </main>
    </div>
  );
}
