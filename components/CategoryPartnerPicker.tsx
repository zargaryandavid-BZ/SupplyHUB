"use client";

import { useState } from "react";
import { ImageUpload } from "./ImageUpload";

export type PartnerOption = {
  id: number;
  company: string;
  categories: string | null;
};

export function CategoryPartnerPicker({
  partners,
  allCategories,
}: {
  partners: PartnerOption[];
  allCategories: string[];
}) {
  const [selected, setSelected] = useState("");

  function partnerCoversCategory(p: PartnerOption, cat: string): boolean {
    return (p.categories || "")
      .split(",")
      .map((c) => c.trim().toLowerCase())
      .includes(cat.toLowerCase());
  }

  const matching = selected ? partners.filter((p) => partnerCoversCategory(p, selected)) : [];
  const others = selected
    ? partners.filter((p) => !partnerCoversCategory(p, selected))
    : partners;

  return (
    <div className="card" style={{ padding: "14px 16px", marginBottom: 0 }}>
      {/* Category selector */}
      <div className="field" style={{ marginBottom: 14 }}>
        <label>Category</label>
        <select
          name="category"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          <option value="">— pick a product type —</option>
          {allCategories.map((c) => (
            <option key={c} value={c}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {/* Partner list */}
      <h3 style={{ margin: "0 0 4px" }}>
        {selected ? `Partners for "${selected}"` : "Send to partners"}
      </h3>

      {!selected && (
        <p className="small muted" style={{ margin: "0 0 10px" }}>
          Pick a category above — matching partners will be suggested automatically.
        </p>
      )}

      {selected && matching.length === 0 && (
        <p className="small muted" style={{ margin: "0 0 10px" }}>
          No active partners cover &ldquo;{selected}&rdquo; yet. You can still select from the list below.
        </p>
      )}

      {/* Matching partners — pre-checked, highlighted */}
      {matching.length > 0 && (
        <div
          className="checks"
          style={{ gridTemplateColumns: "1fr", gap: 6, marginBottom: 8 }}
        >
          {matching.map((p) => (
            <label
              key={p.id}
              className="check"
              style={{ padding: "8px 10px", borderColor: "#93c5fd", background: "#eff6ff" }}
            >
              <input type="checkbox" name="partners" value={p.id} defaultChecked />
              <span>
                <strong>{p.company}</strong>{" "}
                <span className="small" style={{ color: "var(--green)" }}>
                  ✓ covers {selected}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {/* Non-matching partners — dimmed, unchecked */}
      {others.length > 0 && (
        <>
          {selected && matching.length > 0 && (
            <p className="small muted" style={{ margin: "6px 0" }}>
              Other partners
            </p>
          )}
          <div
            className="checks"
            style={{
              gridTemplateColumns: "1fr",
              gap: 6,
              opacity: selected ? 0.45 : 1,
            }}
          >
            {others.map((p) => (
              <label key={p.id} className="check" style={{ padding: "8px 10px" }}>
                <input type="checkbox" name="partners" value={p.id} />
                <span>
                  <strong>{p.company}</strong>{" "}
                  <span className="small muted">· {p.categories}</span>
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
