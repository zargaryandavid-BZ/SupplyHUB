"use client";

import { useEffect, useState } from "react";
import { ImageUpload } from "./ImageUpload";

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

export function NewRequestForm({
  partners,
  products,
  createRequest,
}: {
  partners: PartnerOption[];
  products: string[];
  createRequest: (formData: FormData) => Promise<void>;
}) {
  const [selected, setSelected] = useState("");
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());

  // Pre-select partners who offer the chosen product whenever it changes.
  useEffect(() => {
    const ids = selected
      ? partners.filter((p) => offering(p, selected)).map((p) => p.id)
      : [];
    setCheckedIds(new Set(ids));
  }, [selected, partners]);

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
              <input name="needed_by" type="date" />
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
              <select name="size_unit" defaultValue="mm">
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

          {/* Matching partners — pre-selected */}
          {matching.length > 0 && (
            <div className="checks" style={{ gridTemplateColumns: "1fr", gap: 6, marginBottom: 8 }}>
              {matching.map((p) => {
                const o = offering(p, selected)!;
                const detail = offerLabel(o);
                return (
                  <label
                    key={p.id}
                    className="check"
                    style={{ padding: "8px 10px", borderColor: "#93c5fd", background: "#eff6ff" }}
                  >
                    <input
                      type="checkbox"
                      name="partners"
                      value={p.id}
                      checked={checkedIds.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span>
                      <strong>{p.company}</strong>
                      {detail && (
                        <>
                          {" "}
                          <span className="small" style={{ color: "var(--green-text)" }}>
                            · {detail}
                          </span>
                        </>
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
                style={{ gridTemplateColumns: "1fr", gap: 6, opacity: selected ? 0.45 : 1 }}
              >
                {others.map((p) => (
                  <label key={p.id} className="check" style={{ padding: "8px 10px" }}>
                    <input
                      type="checkbox"
                      name="partners"
                      value={p.id}
                      checked={checkedIds.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <span>
                      <strong>{p.company}</strong>{" "}
                      <span className="small muted">
                        · {p.products.length ? p.products.map((pr) => pr.name).join(", ") : p.categories}
                      </span>
                    </span>
                  </label>
                ))}
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
