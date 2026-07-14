"use client";

import { useState } from "react";
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

export function ProductPartnerPicker({
  partners,
  products,
}: {
  partners: PartnerOption[];
  products: string[];
}) {
  const [selected, setSelected] = useState("");

  const matching = selected ? partners.filter((p) => offering(p, selected)) : [];
  const others = selected
    ? partners.filter((p) => !offering(p, selected))
    : partners;

  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 0 }}>
      {/* Product selector */}
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Product</label>
        <select
          name="category"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— pick a product —</option>
          {products.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        {products.length === 0 && (
          <span className="small muted">
            No partner products yet — add products on partner profiles first.
          </span>
        )}
      </div>

      {/* Partner list */}
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

      {/* Matching partners — pre-checked, with their offer for this product */}
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
                <input type="checkbox" name="partners" value={p.id} defaultChecked />
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

      {/* Other partners — dimmed when a product is selected */}
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
                <input type="checkbox" name="partners" value={p.id} />
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

      {/* Reference images */}
      <div className="field-section-title" style={{ margin: "14px 0 8px" }}>
        Reference images &amp; files
      </div>
      <ImageUpload />
    </div>
  );
}
