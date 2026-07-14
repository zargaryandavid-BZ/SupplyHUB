"use client";

import { useEffect, useRef, useState } from "react";
import type { PartnerProduct } from "@/lib/types";

type Row = {
  name: string;
  notes: string;
  moq: string;
  delivery_days: string;
  price: string;
  currency: string;
  images: string[]; // kept storage keys, length 3 ("" = empty slot)
  existingUrls: (string | null)[]; // resolved public URLs for `images`, length 3
  previews: (string | null)[]; // object URLs for newly-picked files, length 3
  resetTokens: number[]; // bump to force a slot's file input to remount (clears selection)
};

const CURRENCIES = ["USD", "EUR", "GBP", "AMD"];

const ROW_GRID = "1.4fr 2.4fr 0.7fr 1fr 0.85fr 0.85fr 156px 32px";

function toImages(images?: string[]): string[] {
  const base = Array.isArray(images) ? images.slice(0, 3) : [];
  while (base.length < 3) base.push("");
  return base;
}

function toRow(p: PartnerProduct, resolvedUrls: (string | null)[]): Row {
  return {
    name: p.name ?? "",
    notes: p.notes ?? "",
    moq: p.moq != null ? String(p.moq) : "",
    delivery_days: p.delivery_days != null ? String(p.delivery_days) : "",
    price: p.price != null ? String(p.price) : "",
    currency: p.currency || "USD",
    images: toImages(p.images),
    existingUrls: [resolvedUrls[0] ?? null, resolvedUrls[1] ?? null, resolvedUrls[2] ?? null],
    previews: [null, null, null],
    resetTokens: [0, 0, 0],
  };
}

const emptyRow = (): Row => ({
  name: "",
  notes: "",
  moq: "",
  delivery_days: "",
  price: "",
  currency: "USD",
  images: ["", "", ""],
  existingUrls: [null, null, null],
  previews: [null, null, null],
  resetTokens: [0, 0, 0],
});

const cellInput = {
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 13,
  fontFamily: "inherit",
  background: "#fff",
  color: "var(--text)",
  width: "100%",
} as const;

// ── Autocomplete input for product name ──────────────────────────────────────
function ProductNameInput({
  value,
  knownProducts,
  otherRowNames,
  onChange,
}: {
  value: string;
  knownProducts: string[];
  otherRowNames: string[]; // names used in other rows of this partner
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const q = value.trim().toLowerCase();
  // Merge same-partner row names + cross-partner known products into one pool
  const suggestionPool = [...new Set([
    ...otherRowNames.filter((n) => n.trim()),
    ...knownProducts,
  ])];
  const suggestions = q
    ? suggestionPool.filter(
        (p) => p.toLowerCase().includes(q) && p.toLowerCase() !== q
      )
    : [];


  const isDupInRow = otherRowNames.some(
    (n) => n.trim().toLowerCase() === q && q !== ""
  );

  // Close on outside click
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        style={{
          ...cellInput,
          borderColor: isDupInRow ? "var(--red)" : open && suggestions.length ? "var(--indigo)" : "var(--border)",
          boxShadow: open && suggestions.length ? "0 0 0 3px rgba(37,99,235,0.1)" : isDupInRow ? "0 0 0 3px rgba(220,38,38,0.1)" : "none",
        }}
        placeholder="e.g. Corrugated Box"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => { setFocused(true); setOpen(true); }}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
      />

      {/* Suggestions dropdown */}
      {open && suggestions.length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.10)",
            zIndex: 50,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          <div style={{ padding: "4px 10px 4px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--muted)", borderBottom: "1px solid var(--border-soft)" }}>
            Similar products
          </div>
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus
                onChange(s);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "7px 12px",
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "var(--text)",
                fontFamily: "inherit",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f8ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Duplicate warning */}
      {isDupInRow && (
        <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, fontSize: 11, color: "var(--red)", display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Already added
        </div>
      )}
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export function PartnerProducts({
  defaultProducts = [],
  defaultImageUrls = [],
  knownProducts = [],
}: {
  defaultProducts?: PartnerProduct[];
  defaultImageUrls?: (string | null)[][];
  knownProducts?: string[];
}) {
  const [rows, setRows] = useState<Row[]>(
    defaultProducts.length
      ? defaultProducts.map((p, i) => toRow(p, defaultImageUrls[i] ?? []))
      : [emptyRow()]
  );

  // 2-D ref: fileRefs[rowIndex][slotIndex]
  const fileRefs = useRef<(HTMLInputElement | null)[][]>([]);

  function getRef(i: number, k: number): HTMLInputElement | null {
    return fileRefs.current[i]?.[k] ?? null;
  }
  function setRef(i: number, k: number, el: HTMLInputElement | null) {
    if (!fileRefs.current[i]) fileRefs.current[i] = [null, null, null];
    fileRefs.current[i][k] = el;
  }

  function update(
    i: number,
    key: Exclude<keyof Row, "images" | "existingUrls" | "previews" | "resetTokens">,
    value: string
  ) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [key]: value } : r)));
  }

  function pickImage(i: number, k: number, file: File | null) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const previews = [...r.previews];
        if (previews[k]) URL.revokeObjectURL(previews[k]!);
        previews[k] = file ? URL.createObjectURL(file) : null;
        return { ...r, previews };
      })
    );
  }

  function clearImage(i: number, k: number) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const previews = [...r.previews];
        if (previews[k]) URL.revokeObjectURL(previews[k]!);
        previews[k] = null;
        const images = [...r.images];
        images[k] = "";
        const resetTokens = [...r.resetTokens];
        resetTokens[k] += 1;
        return { ...r, previews, images, resetTokens };
      })
    );
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()]);
  }
  function removeRow(i: number) {
    const row = rows[i];
    const label = row?.name?.trim() || "this product";
    if (!window.confirm(`Are you sure you want to remove ${label}?`)) return;
    setRows((prev) => {
      prev[i]?.previews.forEach((url) => url && URL.revokeObjectURL(url));
      return prev.length === 1 ? [emptyRow()] : prev.filter((_, idx) => idx !== i);
    });
  }

  const payload = rows.map((r) => ({
    name: r.name,
    notes: r.notes,
    moq: r.moq,
    delivery_days: r.delivery_days,
    price: r.price,
    currency: r.currency,
    images: r.images,
  }));

  return (
    <div>
      <input type="hidden" name="products" value={JSON.stringify(payload)} />

      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: ROW_GRID,
          gap: 8,
          alignItems: "center",
          padding: "0 2px 8px",
          borderBottom: "1px solid var(--border)",
          marginBottom: 10,
          fontSize: 11,
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.4px",
          color: "var(--muted)",
        }}
      >
        <span>Product</span>
        <span>Info / notes</span>
        <span>MOQ</span>
        <span>Days</span>
        <span>Price</span>
        <span>Currency</span>
        <span>Photos</span>
        <span />
      </div>

      {rows.map((r, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: ROW_GRID,
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
            paddingBottom: 8,
            borderBottom: "1px dashed var(--border-soft)",
          }}
        >
          <ProductNameInput
            value={r.name}
            knownProducts={knownProducts}
            otherRowNames={rows.filter((_, idx) => idx !== i).map((r) => r.name)}
            onChange={(v) => update(i, "name", v)}
          />
          <input
            style={cellInput}
            placeholder="Sizes, specs, notes…"
            value={r.notes}
            onChange={(e) => update(i, "notes", e.target.value)}
          />
          <input
            style={cellInput}
            type="number"
            min="0"
            placeholder="500"
            value={r.moq}
            onChange={(e) => update(i, "moq", e.target.value)}
          />
          <input
            style={cellInput}
            type="number"
            min="0"
            placeholder="14"
            value={r.delivery_days}
            onChange={(e) => update(i, "delivery_days", e.target.value)}
          />
          <input
            style={cellInput}
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={r.price}
            onChange={(e) => update(i, "price", e.target.value)}
          />
          <select
            style={cellInput}
            value={r.currency}
            onChange={(e) => update(i, "currency", e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* 3 clickable photo slots — hidden file inputs triggered via refs */}
          <div style={{ display: "flex", gap: 6 }}>
            {[0, 1, 2].map((k) => {
              const displayUrl = r.previews[k] || (r.images[k] ? r.existingUrls[k] : null);
              return (
                <div key={k} style={{ position: "relative" }}>
                  {/* Hidden file input */}
                  <input
                    key={`img-${i}-${k}-${r.resetTokens[k]}`}
                    ref={(el) => setRef(i, k, el)}
                    type="file"
                    name={`product_image_${i}_${k}`}
                    accept="image/png,image/jpeg,image/webp"
                    style={{
                      position: "absolute",
                      width: 1,
                      height: 1,
                      opacity: 0,
                      pointerEvents: "none",
                      overflow: "hidden",
                    }}
                    onChange={(e) => pickImage(i, k, e.target.files?.[0] ?? null)}
                  />

                  {/* Clickable thumbnail */}
                  <div
                    title={displayUrl ? "Click to replace" : "Click to upload"}
                    onClick={() => getRef(i, k)?.click()}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 8,
                      border: displayUrl
                        ? "1px solid var(--border)"
                        : "1.5px dashed #d1d5db",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: displayUrl ? "#f8fafc" : "#fafafa",
                      cursor: "pointer",
                      overflow: "hidden",
                      transition: "border-color .15s, background .15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = "var(--indigo)";
                      (e.currentTarget as HTMLDivElement).style.background = "#eef2ff";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.borderColor = displayUrl
                        ? "var(--border)"
                        : "#d1d5db";
                      (e.currentTarget as HTMLDivElement).style.background = displayUrl
                        ? "#f8fafc"
                        : "#fafafa";
                    }}
                  >
                    {displayUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={displayUrl}
                        alt={`Image ${k + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        style={{ color: "var(--muted)" }}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    )}
                  </div>

                  {/* Remove badge */}
                  {displayUrl && (
                    <button
                      type="button"
                      onClick={() => clearImage(i, k)}
                      title="Remove image"
                      style={{
                        position: "absolute",
                        top: -5,
                        right: -5,
                        width: 16,
                        height: 16,
                        padding: 0,
                        fontSize: 11,
                        border: "none",
                        borderRadius: "50%",
                        background: "rgba(15,23,42,0.65)",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="prod-remove"
            onClick={() => removeRow(i)}
            aria-label="Remove product"
            title="Remove"
            style={{ visibility: r.name.trim() ? "visible" : "hidden" }}
          >
            ×
          </button>
        </div>
      ))}

      <button type="button" className="btn sm ghost" onClick={addRow} style={{ marginTop: 6 }}>
        + Add product
      </button>
    </div>
  );
}
