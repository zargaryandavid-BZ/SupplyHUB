import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/session";
import { requestDetail, activePartners } from "@/lib/data";
import { awardQuote, postMessage, dispatchToPartners, updateRequest } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { Badge } from "@/components/Badge";
import { RequestDetailsPanel } from "@/components/RequestDetailsPanel";
import { signedAttachmentUrl } from "@/lib/storage";

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

  const [data, remaining] = await Promise.all([
    requestDetail(Number(params.id)),
    activePartners(),
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
        <div className="compare">
          {offers.map((o) => {
            const hasQuote = o.quote_id != null;
            const won = o.quote_status === "won";
            return (
              <div className={`offer ${won ? "won" : ""}`} key={o.dispatch_id}>
                <div className="row-between">
                  <span className="company">{o.company}</span>
                  {o.quote_status && <Badge status={o.quote_status} />}
                </div>
                <div className="small muted">Rating {o.rating?.toFixed(1) ?? "—"}</div>

                {hasQuote ? (
                  <>
                    <div className="price">
                      {o.currency} {o.price?.toLocaleString()}
                      {o.price === bestPrice && (
                        <span className="best small"> ★ lowest</span>
                      )}
                    </div>
                    <div className="row">
                      Lead time: <strong>{o.lead_time_days} days</strong>
                      {o.lead_time_days === bestLead && (
                        <span className="best"> ★ fastest</span>
                      )}
                    </div>
                    <div className="row">Valid until: {o.valid_until || "—"}</div>
                    <div className="row">Revision {o.revision}</div>
                    {o.conditions && <div className="cond">{o.conditions}</div>}

                    {!isAwarded && (
                      <form action={awardQuote} style={{ marginTop: 12 }}>
                        <input type="hidden" name="quote_id" value={o.quote_id!} />
                        <input type="hidden" name="request_id" value={request.id} />
                        <button className="btn green sm" type="submit">
                          Award to {o.company}
                        </button>
                      </form>
                    )}
                    {won && (
                      <p className="small" style={{ color: "#15803d", fontWeight: 600, marginTop: 10 }}>
                        ✓ Winning quote
                      </p>
                    )}
                  </>
                ) : (
                  <p className="small muted" style={{ marginTop: 12 }}>
                    Awaiting quote…
                  </p>
                )}
              </div>
            );
          })}
        </div>

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
      </main>
    </div>
  );
}
