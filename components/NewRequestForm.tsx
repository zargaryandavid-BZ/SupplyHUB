"use client";

import { useEffect, useMemo, useState } from "react";
import { ImageUpload } from "./ImageUpload";
import type { PreviousProductQuote } from "@/lib/data";

export type PartnerProductOption = {
  name: string;
  moq: number | null;
  delivery_days: number | null;
  price: number | null;
  currency: string;
};

export type PartnerOption = {
  id: number;
  company: string;
  categories: string | null;
  products: PartnerProductOption[];
};

const FINISHING = [
  "Gloss Lamination",
  "Matte Lamination",
  "Soft-Touch Lamination",
  "UV Coating",
  "Spot UV",
  "Die Cutting",
  "Foil Stamping",
  "Embossing",
  "Saddle Stitching",
  "Perfect Binding",
  "Spiral / Coil Binding",
  "Folding",
  "Perforation",
  "Rounded Corners",
];

function offering(p: PartnerOption, product: string): PartnerProductOption | undefined {
  return p.products.find((pr) => pr.name.trim().toLowerCase() === product.trim().toLowerCase());
}

function offerLabel(o: PartnerProductOption): string {
  const parts: string[] = [];
  if (o.price != null) parts.push(`${o.currency} ${o.price.toLocaleString()}`);
  if (o.moq != null) parts.push(`MOQ ${o.moq.toLocaleString()}`);
  if (o.delivery_days != null) parts.push(`${o.delivery_days} days`);
  return parts.join(" · ");
}

function formatMoney(currency: string, amount: number): string {
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function formatQuoteDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function unitPrice(q: PreviousProductQuote): number | null {
  if (q.quantity == null || q.quantity <= 0) return null;
  return q.price / q.quantity;
}

export function NewRequestForm({
  partners,
  products,
  createRequest,
  fetchRecentQuotes,
}: {
  partners: PartnerOption[];
  products: string[];
  createRequest: (formData: FormData) => Promise<void>;
  fetchRecentQuotes: (productName: string) => Promise<PreviousProductQuote[]>;
}) {
  const [selected, setSelected] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [recentQuotes, setRecentQuotes] = useState<PreviousProductQuote[]>([]);
  const [quotesPending, setQuotesPending] = useState(false);

  // Pre-select partners who offer the chosen product whenever it changes.
  useEffect(() => {
    const ids = selected
      ? partners.filter((p) => offering(p, selected)).map((p) => p.id)
      : [];
    setCheckedIds(new Set(ids));
  }, [selected, partners]);

  // Load last quotes for the selected product (up to 5 per partner).
  useEffect(() => {
    if (!selected) {
      setRecentQuotes([]);
      setQuotesPending(false);
      return;
    }
    let cancelled = false;
    setQuotesPending(true);
    fetchRecentQuotes(selected)
      .then((rows) => {
        if (!cancelled) setRecentQuotes(rows);
      })
      .catch(() => {
        if (!cancelled) setRecentQuotes([]);
      })
      .finally(() => {
        if (!cancelled) setQuotesPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, fetchRecentQuotes]);

  function toggle(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const matching = selected ? partners.filter((p) => offering(p, selected)) : [];
  const others = selected ? partners.filter((p) => !offering(p, selected)) : partners;
  const canSend = checkedIds.size > 0;
  const isBox = /box/i.test(selected);

  const quotesByPartner = useMemo(() => {
    const map = new Map<number, PreviousProductQuote[]>();
    for (const q of recentQuotes) {
      const list = map.get(q.partner_id) ?? [];
      list.push(q);
      map.set(q.partner_id, list);
    }
    return map;
  }, [recentQuotes]);

  const priceRoll = useMemo(() => {
    if (!recentQuotes.length) return null;
    const byCurrency = new Map<string, number[]>();
    for (const q of recentQuotes) {
      const unit = unitPrice(q);
      const value = unit ?? q.price;
      const list = byCurrency.get(q.currency) ?? [];
      list.push(value);
      byCurrency.set(q.currency, list);
    }
    return [...byCurrency.entries()].map(([currency, values]) => {
      const min = Math.min(...values);
      const max = Math.max(...values);
      const hasUnits = recentQuotes.some((q) => q.currency === currency && unitPrice(q) != null);
      return { currency, min, max, hasUnits };
    });
  }, [recentQuotes]);

  return (
    <form id="new-request-form" action={createRequest}>
      <div className="grid cols-2" style={{ alignItems: "start", gap: 12 }}>

        {/* ── Left column: request details + finishing ── */}
        <div>
        <div className="card" style={{ padding: "12px 14px", marginBottom: 12 }}>
          <h3 style={{ marginBottom: 8 }}>Request</h3>

          <div className="grid cols-3" style={{ gap: 10, gridTemplateColumns: "2fr 1fr 1fr" }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Product *</label>
              <select name="category" required value={selected} onChange={(e) => setSelected(e.target.value)}>
                <option value="">— pick a product —</option>
                {products.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Quantity *</label>
              <input name="quantity" type="number" min="1" required placeholder="5000" />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Needed by</label>
              <input
                name="needed_by"
                type="date"
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 8 }}>
            <label>Request title <span className="small muted">(optional)</span></label>
            <input name="title" placeholder="Auto-filled from product if left blank" />
          </div>

          {/* Dimensions — X / Y / Z (Z required for boxes) */}
          <div className="grid" style={{ gap: 10, gridTemplateColumns: "1fr 1fr 1fr 0.9fr 2.8fr" }}>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Width (X)</label>
              <input name="width" type="number" min="0" step="0.1" placeholder="210" />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Height (Y)</label>
              <input name="height" type="number" min="0" step="0.1" placeholder="297" />
            </div>
            <div
              className="field"
              style={{
                marginBottom: 8,
                ...(isBox
                  ? {
                      background: "#eff6ff",
                      border: "1px solid #93c5fd",
                      borderRadius: 6,
                      padding: "4px 8px",
                    }
                  : {}),
              }}
            >
              <label>
                Depth (Z){isBox && <span style={{ color: "#2563eb", marginLeft: 4 }}>*</span>}
              </label>
              <input
                name="depth"
                type="number"
                min="0"
                step="0.1"
                placeholder={isBox ? "e.g. 150" : "for boxes"}
                required={isBox}
                style={isBox ? { borderColor: "#93c5fd" } : {}}
              />
              {isBox && (
                <span className="small" style={{ color: "#2563eb", marginTop: 2, display: "block" }}>
                  Required for boxes
                </span>
              )}
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Unit</label>
              <select name="size_unit" defaultValue="in">
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Request no.</label>
              <input name="order_number" placeholder="ORD-1004" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Specifications</label>
            <textarea
              name="specs"
              placeholder="Colors, paper weight, binding, special instructions…"
              style={{ minHeight: 40 }}
            />
          </div>
        </div>

        {/* Finishing — under the Request box (left column) */}
        <div className="card" style={{ padding: "12px 14px", marginBottom: 12 }}>
          <div className="field-section-title" style={{ marginBottom: 6 }}>
            Finishing
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {FINISHING.map((f) => (
              <label className="check" key={f} style={{ padding: "6px 10px", gap: 6 }}>
                <input type="checkbox" name="finishing" value={f} />
                <span>{f}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Reference images & files — under the Request box (left column) */}
        <div className="card" style={{ padding: "12px 14px", marginBottom: 0 }}>
          <div className="field-section-title" style={{ marginBottom: 6 }}>
            Reference images &amp; files
          </div>
          <ImageUpload />
        </div>
        </div>

        {/* ── Right column: partner list + Send button ── */}
        <div>
        <div className="card" style={{ padding: "12px 14px", marginBottom: 0 }}>
          <h3 style={{ margin: "0 0 4px" }}>
            {selected ? `Partners offering "${selected}"` : "Send to partners"}
          </h3>

          {!selected && (
            <p className="small muted" style={{ margin: "0 0 10px" }}>
              Pick a product above — partners who offer it appear here automatically.
            </p>
          )}

          {selected && matching.length === 0 && (
            <p className="small muted" style={{ margin: "0 0 10px" }}>
              No partner offers &ldquo;{selected}&rdquo; yet. You can still select from the list below.
            </p>
          )}

          {selected && (
            <div className="small muted" style={{ margin: "0 0 10px" }}>
              {quotesPending ? (
                <>Loading previous quotes…</>
              ) : priceRoll && priceRoll.length > 0 ? (
                <>
                  Recent quote roll:{" "}
                  {priceRoll.map((r, i) => (
                    <span key={r.currency}>
                      {i > 0 ? " · " : ""}
                      <span style={{ color: "var(--text)", fontWeight: 600 }}>
                        {r.min === r.max
                          ? formatMoney(r.currency, r.min)
                          : `${formatMoney(r.currency, r.min)} – ${formatMoney(r.currency, r.max)}`}
                      </span>
                      {r.hasUnits ? " / unit" : ""}
                    </span>
                  ))}{" "}
                  <span>(last up to 5 per partner)</span>
                </>
              ) : (
                <>No previous quotes for this product yet.</>
              )}
            </div>
          )}

          {/* Matching partners — pre-selected */}
          {matching.length > 0 && (
            <div className="checks" style={{ gridTemplateColumns: "1fr", gap: 6, marginBottom: 8 }}>
              {matching.map((p) => {
                const o = offering(p, selected)!;
                const detail = offerLabel(o);
                const history = quotesByPartner.get(p.id) ?? [];
                return (
                  <label
                    key={p.id}
                    className="check"
                    style={{
                      padding: "8px 10px",
                      borderColor: "#93c5fd",
                      background: "#eff6ff",
                      alignItems: "flex-start",
                    }}
                  >
                    <input
                      type="checkbox"
                      name="partners"
                      value={p.id}
                      checked={checkedIds.has(p.id)}
                      onChange={() => toggle(p.id)}
                      style={{ marginTop: 3 }}
                    />
                    <span style={{ display: "block", minWidth: 0 }}>
                      <strong>{p.company}</strong>
                      {detail && (
                        <>
                          {" "}
                          <span className="small" style={{ color: "var(--green-text)" }}>
                            · Catalog {detail}
                          </span>
                        </>
                      )}
                      {history.length > 0 ? (
                        <ul
                          style={{
                            margin: "6px 0 0",
                            padding: "0 0 0 14px",
                            listStyle: "disc",
                          }}
                        >
                          {history.map((q) => {
                            const unit = unitPrice(q);
                            return (
                              <li
                                key={`${q.request_id}-${q.revision}-${q.created_at}`}
                                className="small"
                                style={{ marginBottom: 2, color: "var(--muted)" }}
                              >
                                <span style={{ color: "var(--text)", fontWeight: 600 }}>
                                  {formatMoney(q.currency, q.price)}
                                </span>
                                {q.quantity != null && (
                                  <> · qty {q.quantity.toLocaleString()}</>
                                )}
                                {unit != null && (
                                  <> · {formatMoney(q.currency, unit)}/u</>
                                )}
                                {q.lead_time_days != null && <> · {q.lead_time_days}d</>}
                                {" · "}
                                <span style={{ textTransform: "capitalize" }}>{q.status}</span>
                                {" · "}
                                {formatQuoteDate(q.created_at)}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        !quotesPending && (
                          <div className="small muted" style={{ marginTop: 4 }}>
                            No previous quotes from this partner
                          </div>
                        )
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          )}

          {/* Other partners */}
          {others.length > 0 && (
            <>
              {selected && matching.length > 0 && (
                <p className="small muted" style={{ margin: "6px 0" }}>
                  Other partners
                </p>
              )}
              <div
                className="checks"
                style={{ gridTemplateColumns: "1fr", gap: 6 }}
              >
                {[...others]
                  .sort((a, b) => {
                    const ha = quotesByPartner.get(a.id)?.length ?? 0;
                    const hb = quotesByPartner.get(b.id)?.length ?? 0;
                    return hb - ha;
                  })
                  .map((p) => {
                    const history = quotesByPartner.get(p.id) ?? [];
                    const hasHistory = history.length > 0;
                    return (
                      <label
                        key={p.id}
                        className="check"
                        style={{
                          padding: "8px 10px",
                          opacity: selected && !hasHistory ? 0.45 : 1,
                          alignItems: "flex-start",
                          ...(hasHistory
                            ? { borderColor: "#fcd34d", background: "#fffbeb" }
                            : null),
                        }}
                      >
                        <input
                          type="checkbox"
                          name="partners"
                          value={p.id}
                          checked={checkedIds.has(p.id)}
                          onChange={() => toggle(p.id)}
                          style={{ marginTop: 3 }}
                        />
                        <span style={{ display: "block", minWidth: 0 }}>
                          <strong>{p.company}</strong>{" "}
                          <span className="small muted">
                            · {p.products.length ? p.products.map((pr) => pr.name).join(", ") : p.categories}
                          </span>
                          {hasHistory && (
                            <ul
                              style={{
                                margin: "6px 0 0",
                                padding: "0 0 0 14px",
                                listStyle: "disc",
                              }}
                            >
                              {history.map((q) => {
                                const unit = unitPrice(q);
                                return (
                                  <li
                                    key={`${q.request_id}-${q.revision}-${q.created_at}`}
                                    className="small"
                                    style={{ marginBottom: 2, color: "var(--muted)" }}
                                  >
                                    <span style={{ color: "var(--text)", fontWeight: 600 }}>
                                      {formatMoney(q.currency, q.price)}
                                    </span>
                                    {q.quantity != null && (
                                      <> · qty {q.quantity.toLocaleString()}</>
                                    )}
                                    {unit != null && (
                                      <> · {formatMoney(q.currency, unit)}/u</>
                                    )}
                                    {q.lead_time_days != null && <> · {q.lead_time_days}d</>}
                                    {" · "}
                                    <span style={{ textTransform: "capitalize" }}>{q.status}</span>
                                    {" · "}
                                    {formatQuoteDate(q.created_at)}
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </>
          )}
        </div>

        {/* Send — under the partner box; enabled once a partner is selected */}
        <button
          className="btn"
          type="submit"
          disabled={!canSend}
          style={{ marginTop: 12, width: "100%", opacity: canSend ? 1 : 0.5, cursor: canSend ? "pointer" : "not-allowed" }}
        >
          Send
        </button>
        {!canSend && (
          <p className="small muted" style={{ margin: "6px 0 0", textAlign: "center" }}>
            Select at least one partner to send.
          </p>
        )}
        </div>
      </div>
    </form>
  );
}
