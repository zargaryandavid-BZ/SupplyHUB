"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
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

const DRAFT_KEY = "supplyhub-new-request-draft";

interface FormDraft {
  selected: string;
  checkedIds: number[];
  skuRows: { sku: string; qty: string }[];
  title: string;
  quantity: string;
  neededBy: string;
  width: string;
  height: string;
  depth: string;
  sizeUnit: string;
  orderNumber: string;
  specs: string;
  finishing: string[];
  savedAt: number;
}

function loadDraft(): FormDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FormDraft;
  } catch {
    return null;
  }
}

function saveDraft(draft: FormDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch { /* storage unavailable */ }
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
}

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return `${hrs} hr ago`;
}

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
  // Controlled form fields (enables auto-save)
  const [selected, setSelected] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [skuRows, setSkuRows] = useState<{ sku: string; qty: string }[]>([{ sku: "", qty: "" }]);
  const [title, setTitle] = useState("");
  const [quantity, setQuantity] = useState("");
  const [neededBy, setNeededBy] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [depth, setDepth] = useState("");
  const [sizeUnit, setSizeUnit] = useState("in");
  const [orderNumber, setOrderNumber] = useState("");
  const [specs, setSpecs] = useState("");
  const [finishing, setFinishing] = useState<Set<string>>(new Set());

  // Draft state
  const [draftBanner, setDraftBanner] = useState<{ savedAt: number } | null>(null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [recentQuotes, setRecentQuotes] = useState<PreviousProductQuote[]>([]);
  const [quotesPending, setQuotesPending] = useState(false);

  // ── On mount: check for saved draft ──────────────────────────────
  useEffect(() => {
    const draft = loadDraft();
    if (draft && !draftDismissed) setDraftBanner({ savedAt: draft.savedAt });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function restoreDraft() {
    const draft = loadDraft();
    if (!draft) return;
    setSelected(draft.selected ?? "");
    setCheckedIds(new Set(draft.checkedIds ?? []));
    setSkuRows(draft.skuRows?.length ? draft.skuRows : [{ sku: "", qty: "" }]);
    setTitle(draft.title ?? "");
    setQuantity(draft.quantity ?? "");
    setNeededBy(draft.neededBy ?? "");
    setWidth(draft.width ?? "");
    setHeight(draft.height ?? "");
    setDepth(draft.depth ?? "");
    setSizeUnit(draft.sizeUnit ?? "in");
    setOrderNumber(draft.orderNumber ?? "");
    setSpecs(draft.specs ?? "");
    setFinishing(new Set(draft.finishing ?? []));
    setDraftBanner(null);
  }

  function dismissDraft() {
    setDraftBanner(null);
    setDraftDismissed(true);
    clearDraft();
  }

  // ── Auto-save: debounced 1.5s after any field change ─────────────
  useEffect(() => {
    if (draftDismissed) return;
    const hasContent = selected || title || quantity || specs || width || height;
    if (!hasContent && checkedIds.size === 0 && skuRows.every((r) => !r.sku && !r.qty)) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      saveDraft({
        selected, checkedIds: [...checkedIds], skuRows,
        title, quantity, neededBy, width, height, depth, sizeUnit,
        orderNumber, specs, finishing: [...finishing], savedAt: Date.now(),
      });
    }, 1500);
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, checkedIds, skuRows, title, quantity, neededBy, width, height, depth, sizeUnit, orderNumber, specs, finishing]);

  const addSkuRow = useCallback(() => setSkuRows((r) => [...r, { sku: "", qty: "" }]), []);
  const removeSkuRow = useCallback((i: number) => setSkuRows((r) => r.length === 1 ? r : r.filter((_, idx) => idx !== i)), []);
  const updateSkuRow = useCallback((i: number, field: "sku" | "qty", val: string) =>
    setSkuRows((r) => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row)), []);

  const skuItemsJson = JSON.stringify(
    skuRows.filter((r) => r.sku.trim() || r.qty.trim()).map((r) => ({ sku: r.sku.trim(), qty: Number(r.qty) || 0 }))
  );

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
      .then((rows) => { if (!cancelled) setRecentQuotes(rows); })
      .catch(() => { if (!cancelled) setRecentQuotes([]); })
      .finally(() => { if (!cancelled) setQuotesPending(false); });
    return () => { cancelled = true; };
  }, [selected, fetchRecentQuotes]);

  function toggle(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleFinishing(f: string) {
    setFinishing((prev) => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
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
    <>
      {/* ── Draft restore banner ── */}
      {draftBanner && !draftDismissed && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between",
          background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8,
          padding: "10px 14px", marginBottom: 12, fontSize: 13,
        }}>
          <span>
            <strong>Unsaved draft found</strong> — saved {timeAgo(draftBanner.savedAt)}.
            Restore your previous work?
          </span>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button
              type="button"
              className="btn"
              style={{ fontSize: 12, padding: "4px 12px", height: 28 }}
              onClick={restoreDraft}
            >
              Restore draft
            </button>
            <button
              type="button"
              onClick={dismissDraft}
              style={{
                fontSize: 12, padding: "4px 10px", height: 28, border: "1px solid var(--border)",
                borderRadius: 6, background: "#fff", cursor: "pointer", fontFamily: "inherit",
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <form id="new-request-form" action={(fd) => { clearDraft(); createRequest(fd); }}>
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
              <input name="quantity" type="number" min="1" required placeholder="5000"
                value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 8 }}>
              <label>Needed by</label>
              <input name="needed_by" type="date"
                min={new Date().toISOString().split("T")[0]}
                value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 8 }}>
            <label>Request title <span className="small muted">(optional)</span></label>
            <input name="title" placeholder="Auto-filled from product if left blank"
              value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* Dimensions + Unit + Request no. — all one line */}
          <div style={{ display: "flex", flexWrap: "nowrap", gap: 10, alignItems: "flex-start", overflowX: "auto" }}>
            <div className="field" style={{ marginBottom: 8, minWidth: 80, flex: "1 1 80px" }}>
              <label>Width (X)</label>
              <input name="width" type="number" min="0" step="0.1" placeholder="210"
                value={width} onChange={(e) => setWidth(e.target.value)} />
            </div>
            <div className="field" style={{ marginBottom: 8, minWidth: 80, flex: "1 1 80px" }}>
              <label>Height (Y)</label>
              <input name="height" type="number" min="0" step="0.1" placeholder="297"
                value={height} onChange={(e) => setHeight(e.target.value)} />
            </div>
            <div
              className="field"
              style={{
                marginBottom: 8, minWidth: 80, flex: "1 1 80px",
                ...(isBox ? { background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6, padding: "4px 8px" } : {}),
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
                value={depth} onChange={(e) => setDepth(e.target.value)}
              />
              {isBox && (
                <span className="small" style={{ color: "#2563eb", marginTop: 2, display: "block" }}>
                  Required for boxes
                </span>
              )}
            </div>
            <div className="field" style={{ marginBottom: 8, minWidth: 70, flex: "0 0 80px" }}>
              <label>Unit</label>
              <select name="size_unit" value={sizeUnit} onChange={(e) => setSizeUnit(e.target.value)}>
                <option value="mm">mm</option>
                <option value="cm">cm</option>
                <option value="in">in</option>
              </select>
            </div>
            <div className="field" style={{ marginBottom: 8, minWidth: 120, flex: "2 1 140px" }}>
              <label>Request no.</label>
              <input name="order_number" placeholder="ORD-1004"
                value={orderNumber} onChange={(e) => setOrderNumber(e.target.value)} />
            </div>
          </div>

          {/* SKU table */}
          <div style={{ marginBottom: 8, background: "#f8fafc", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                SKUs
                <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 12, marginLeft: 6 }}>optional — one row per variant</span>
              </span>
              <button
                type="button"
                onClick={addSkuRow}
                style={{
                  fontSize: 12, fontWeight: 600, color: "var(--indigo)",
                  background: "#fff", border: "1px solid var(--indigo-100)",
                  borderRadius: 6, padding: "4px 12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                <span style={{ fontSize: 15, lineHeight: 1 }}>+</span> Add SKU
              </button>
            </div>
            <input type="hidden" name="sku_items" value={skuItemsJson} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 28px", gap: 6, marginBottom: 4, padding: "0 2px" }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>SKU / Variant name</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.4px", textAlign: "right" }}>Quantity</span>
              <span />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {skuRows.map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 120px 28px", gap: 6, alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder={`e.g. SKU-00${i + 1}, Red / Large…`}
                    value={row.sku}
                    onChange={(e) => updateSkuRow(i, "sku", e.target.value)}
                    style={{ fontSize: 13, padding: "6px 9px", border: "1px solid var(--border)", borderRadius: 6, background: "#fff", width: "100%", boxSizing: "border-box" }}
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={row.qty}
                    onChange={(e) => updateSkuRow(i, "qty", e.target.value)}
                    style={{ fontSize: 13, padding: "6px 9px", border: "1px solid var(--border)", borderRadius: 6, background: "#fff", textAlign: "right", width: "100%", boxSizing: "border-box",
                      MozAppearance: "textfield" as React.CSSProperties["MozAppearance"] }}
                  />
                  <button
                    type="button"
                    onClick={() => removeSkuRow(i)}
                    disabled={skuRows.length === 1}
                    style={{
                      width: 26, height: 26, border: "none", padding: 0,
                      background: skuRows.length === 1 ? "transparent" : "#fee2e2",
                      cursor: skuRows.length === 1 ? "not-allowed" : "pointer",
                      color: skuRows.length === 1 ? "var(--border)" : "#dc2626",
                      fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 5, fontWeight: 700, transition: "background .12s",
                    }}
                    title="Remove row"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="field" style={{ marginBottom: 0 }}>
            <label>Specifications</label>
            <textarea
              name="specs"
              placeholder="Colors, paper weight, binding, special instructions…"
              style={{ minHeight: 40 }}
              value={specs} onChange={(e) => setSpecs(e.target.value)}
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
                <input type="checkbox" name="finishing" value={f}
                  checked={finishing.has(f)} onChange={() => toggleFinishing(f)} />
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
                        <ul style={{ margin: "6px 0 0", padding: "0 0 0 14px", listStyle: "disc" }}>
                          {history.map((q) => {
                            const unit = unitPrice(q);
                            return (
                              <li key={`${q.request_id}-${q.revision}-${q.created_at}`} className="small" style={{ marginBottom: 2, color: "var(--muted)" }}>
                                <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatMoney(q.currency, q.price)}</span>
                                {q.quantity != null && <> · qty {q.quantity.toLocaleString()}</>}
                                {unit != null && <> · {formatMoney(q.currency, unit)}/u</>}
                                {q.lead_time_days != null && <> · {q.lead_time_days}d</>}
                                {" · "}<span style={{ textTransform: "capitalize" }}>{q.status}</span>
                                {" · "}{formatQuoteDate(q.created_at)}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        !quotesPending && (
                          <div className="small muted" style={{ marginTop: 4 }}>No previous quotes from this partner</div>
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
                <p className="small muted" style={{ margin: "6px 0" }}>Other partners</p>
              )}
              <div className="checks" style={{ gridTemplateColumns: "1fr", gap: 6 }}>
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
                          ...(hasHistory ? { borderColor: "#fcd34d", background: "#fffbeb" } : null),
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
                            <ul style={{ margin: "6px 0 0", padding: "0 0 0 14px", listStyle: "disc" }}>
                              {history.map((q) => {
                                const unit = unitPrice(q);
                                return (
                                  <li key={`${q.request_id}-${q.revision}-${q.created_at}`} className="small" style={{ marginBottom: 2, color: "var(--muted)" }}>
                                    <span style={{ color: "var(--text)", fontWeight: 600 }}>{formatMoney(q.currency, q.price)}</span>
                                    {q.quantity != null && <> · qty {q.quantity.toLocaleString()}</>}
                                    {unit != null && <> · {formatMoney(q.currency, unit)}/u</>}
                                    {q.lead_time_days != null && <> · {q.lead_time_days}d</>}
                                    {" · "}<span style={{ textTransform: "capitalize" }}>{q.status}</span>
                                    {" · "}{formatQuoteDate(q.created_at)}
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
    </>
  );
}
