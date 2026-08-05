"use client";

import Link from "next/link";
import { Badge } from "@/components/Badge";
import { ProposalPanel, type OfferData } from "@/components/ProposalPanel";

export interface OfferRow {
  dispatch_id: number;
  partner_id: number;
  company: string;
  rating: number | null;
  seen_at: string | null;
  quote_id: number | null;
  quote_status: string | null;
  price: number | null;
  currency: string;
  lead_time_days: number | null;
  valid_until: string | null;
  conditions: string | null;
  revision: number;
}

interface QuoteOfferListProps {
  offers: OfferRow[];
  requestId: number;
  requestTitle: string;
  bestPrice: number | null;
  bestLead: number | null;
  isAwarded: boolean;
  companyName?: string;
  logoUrl?: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  awardAction: (formData: FormData) => Promise<any>;
}

export function QuoteOfferList({
  offers,
  requestId,
  requestTitle,
  bestPrice,
  bestLead,
  isAwarded,
  companyName,
  logoUrl,
  awardAction,
}: QuoteOfferListProps) {
  return (
    <div className="compare">
      {offers.map((o) => {
        const hasQuote = o.quote_id != null;
        const won = o.quote_status === "won";

        const offerData: OfferData = {
          quoteId: o.quote_id,
          dispatchId: o.dispatch_id,
          requestId,
          requestTitle,
          partnerName: o.company,
          basePrice: o.price,
          currency: o.currency ?? "USD",
          companyName,
          logoUrl,
        };

        return (
          <div className={`offer ${won ? "won" : ""}`} key={o.dispatch_id}>
            <div className="row-between">
              <Link
                href={`/manager/partners/${o.partner_id}/edit`}
                style={{ fontWeight: 700, fontSize: 15, color: "var(--indigo)", textDecoration: "none" }}
                className="company"
              >
                {o.company}
              </Link>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {o.seen_at ? (
                  <span
                    title={`Opened ${new Date(o.seen_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}`}
                    style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", display: "inline-flex", alignItems: "center", gap: 3 }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    Seen
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                    Not seen
                  </span>
                )}
                {o.quote_status && <Badge status={o.quote_status} />}
              </div>
            </div>

            <div className="small muted">Rating {o.rating?.toFixed(1) ?? "—"}</div>

            {hasQuote ? (
              <>
                <div className="price">
                  {o.currency} {o.price?.toLocaleString()}
                  {o.price === bestPrice && <span className="best small"> ★ lowest</span>}
                </div>
                <div className="row">
                  Lead time: <strong>{o.lead_time_days} days</strong>
                  {o.lead_time_days === bestLead && <span className="best"> ★ fastest</span>}
                </div>
                <div className="row">Valid until: {o.valid_until || "—"}</div>
                <div className="row">Revision {o.revision}</div>
                {o.conditions && <div className="cond">{o.conditions}</div>}

                {/* Send-to-client proposal button */}
                <div style={{ marginTop: 10 }}>
                  <ProposalPanel offer={offerData} fullWidth />
                </div>

                {!isAwarded && (
                  <form action={awardAction} style={{ marginTop: 8 }}>
                    <input type="hidden" name="quote_id" value={o.quote_id!} />
                    <input type="hidden" name="request_id" value={requestId} />
                    <button className="btn green sm" type="submit" style={{ width: "100%" }}>
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
              <>
                {/* Still allow sending proposal even without quote */}
                <p className="small muted" style={{ marginTop: 12 }}>Awaiting quote…</p>
                <div style={{ marginTop: 8 }}>
                  <ProposalPanel offer={offerData} fullWidth />
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
