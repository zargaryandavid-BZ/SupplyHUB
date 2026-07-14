import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/session";
import { partnerRequestDetail } from "@/lib/data";
import { submitQuote, postMessage } from "@/app/actions";
import { QuoteForm } from "@/components/QuoteForm";
import { Sidebar } from "@/components/Sidebar";
import { signedAttachmentUrl } from "@/lib/storage";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function PartnerRequestDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { saved?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "partner") redirect("/");
  const [data, settings] = await Promise.all([
    partnerRequestDetail(actor.partnerId, Number(params.id)),
    getSettings(),
  ]);
  if (!data) notFound();
  const { row, quote = null, messages } = data;

  // Resolve attachment keys → signed URLs (private bucket, 1 h expiry)
  let attachmentUrls: { url: string; name: string }[] = [];
  if (row.attachments) {
    try {
      const keys: string[] = JSON.parse(row.attachments);
      attachmentUrls = await Promise.all(
        keys.map(async (key) => ({
          url: await signedAttachmentUrl(key),
          name: key.split("/").pop() ?? key,
        }))
      );
    } catch {
      /* malformed JSON — skip */
    }
  }

  const isAwarded = row.status === "awarded" || row.status === "closed";
  const won = quote?.status === "won";
  const lost = quote?.status === "lost";

  return (
    <div className="app">
      <Sidebar active="myreq" />
      <main className="main">
        <div className="page-head">
          <div>
            <h1>{row.title}</h1>
            <p>{row.category} · Needed by {row.needed_by || "—"}</p>
          </div>
          <Link href="/partner" className="btn ghost">
            ← My requests
          </Link>
        </div>

        {searchParams.saved && <div className="notice">Your quote has been submitted.</div>}
        {won && <div className="notice">🎉 You won this order! The print house will be in touch.</div>}
        {lost && (
          <div className="notice" style={{ background: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" }}>
            This order went to another partner. Thanks for quoting.
          </div>
        )}

        <div className="card">
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 14, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Request details</h3>
            {/* Distribution manager contact */}
            {(settings.contact_name || settings.manager_name) && (
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: "#f8fafc", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 14px",
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "var(--indigo)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 13, fontWeight: 700, flexShrink: 0,
                }}>
                  {(settings.contact_name || settings.manager_name || "?")[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>
                    {settings.contact_name || settings.manager_name}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--muted)", display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {(settings.contact_phone || settings.manager_phone) && (
                      <a href={`tel:${settings.contact_phone || settings.manager_phone}`}
                        style={{ color: "var(--indigo)", textDecoration: "none" }}>
                        {settings.contact_phone || settings.manager_phone}
                      </a>
                    )}
                    {(settings.contact_email || settings.manager_email) && (
                      <a href={`mailto:${settings.contact_email || settings.manager_email}`}
                        style={{ color: "var(--indigo)", textDecoration: "none" }}>
                        {settings.contact_email || settings.manager_email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>
            {/* Column 1 — request fields */}
            <dl className="dl">
              <dt>Product</dt>
              <dd>{row.category || row.title}</dd>
              <dt>Title</dt>
              <dd>{row.title}</dd>
              <dt>Quantity</dt>
              <dd>{row.quantity ? row.quantity.toLocaleString() : "—"}</dd>
              <dt>Needed by</dt>
              <dd>
                {row.needed_by ? (
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "#fef9c3", color: "#92400e",
                    border: "1px solid #fde68a",
                    borderRadius: 6, padding: "2px 10px",
                    fontWeight: 600, fontSize: 13,
                  }}>
                    📅 {row.needed_by}
                  </span>
                ) : "—"}
              </dd>
              <dt>Dimensions</dt>
              <dd>
                {[row.width, row.height, row.depth].filter((v) => v != null).length
                  ? `${[row.width, row.height, row.depth].filter((v) => v != null).join(" × ")} ${row.size_unit || "mm"}`
                  : row.standard_size || "—"}
              </dd>
              <dt>Material</dt>
              <dd>{row.material || "—"}</dd>
              <dt>Finishing</dt>
              <dd>{row.finishing || "—"}</dd>
              <dt>Specifications</dt>
              <dd style={{ whiteSpace: "pre-wrap" }}>{row.specs || "—"}</dd>
            </dl>

            {/* Column 2 — attachments */}
            <div>
              <p className="small" style={{ fontWeight: 600, marginBottom: 10, color: "#374151" }}>
                Attachments
              </p>
              {attachmentUrls.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {attachmentUrls.map((a) => {
                    const image = /\.(png|jpe?g|webp|gif|svg)$/i.test(a.name);
                    return (
                      <a
                        key={a.url}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={a.name}
                        style={{ display: "block", textDecoration: "none" }}
                      >
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.url}
                            alt={a.name}
                            style={{
                              width: 120,
                              height: 120,
                              objectFit: "cover",
                              borderRadius: 8,
                              border: "1px solid var(--border)",
                              display: "block",
                              background: "#f8fafc",
                            }}
                          />
                        ) : (
                          <span className="btn ghost sm">↓ {a.name}</span>
                        )}
                      </a>
                    );
                  })}
                </div>
              ) : (
                <p className="small muted">No attachments.</p>
              )}
            </div>
          </div>
        </div>

        <QuoteForm
          dispatchId={row.dispatch_id}
          requestId={row.id}
          quote={quote}
          isAwarded={isAwarded}
          submitQuote={submitQuote}
        />

        <div className="card">
          <h3>Questions &amp; comments</h3>
          {messages.length === 0 && (
            <p className="small muted">Ask the print house if anything is unclear.</p>
          )}
          <ul className="thread">
            {messages.map((m) => (
              <li key={m.id}>
                <span className={`who ${m.author_role}`}>
                  {m.author_role === "partner" ? "You" : "Print House"}
                </span>{" "}
                <span className="when">{m.created_at}</span>
                <div>{m.text}</div>
              </li>
            ))}
          </ul>
          <hr className="sep" />
          <form action={postMessage}>
            <input type="hidden" name="request_id" value={row.id} />
            <input type="hidden" name="partner_id" value={actor.partnerId} />
            <input type="hidden" name="author_role" value="partner" />
            <input type="hidden" name="back_to" value={`/partner/requests/${row.id}`} />
            <div className="field">
              <label>Ask a question</label>
              <textarea name="text" placeholder="e.g. Is the cover matte or gloss?" />
            </div>
            <button className="btn" type="submit">
              Send
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
