"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import type { PartnerRequestRow } from "@/lib/data";
import { Badge } from "@/components/Badge";

type Props = {
  items: PartnerRequestRow[];
};

const STATUS_OPTIONS = [
  { label: "All statuses", value: "" },
  { label: "Awaiting quote", value: "awaiting" },
  { label: "Submitted", value: "submitted" },
  { label: "Not selected", value: "lost" },
];

function statusLabel(r: PartnerRequestRow) {
  if (!r.quote_status) return "awaiting";
  return r.quote_status;
}

export function PartnerRequestsTable({ items }: Props) {
  const [activeFilter, setActiveFilter] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const filtered = activeFilter
    ? items.filter((r) => statusLabel(r) === activeFilter)
    : items;

  const activeOption = STATUS_OPTIONS.find((o) => o.value === activeFilter) ?? STATUS_OPTIONS[0];

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: 22 }}>
      <style>{`
        .filter-dropdown {
          position: absolute; top: calc(100% + 6px); left: 0; z-index: 50;
          background: #fff; border: 1px solid var(--border);
          border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          min-width: 170px; overflow: hidden;
        }
        .filter-option {
          display: flex; align-items: center; gap: 8px;
          padding: 8px 12px; font-size: 13px; cursor: pointer;
          transition: background .12s;
        }
        .filter-option:hover { background: var(--indigo-50, #eef2ff); }
        .filter-option.active { font-weight: 600; color: var(--indigo); }
        .filter-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <h3 style={{ margin: 0 }}>
          Requests
          {activeFilter && (
            <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
              — {activeOption.label}
            </span>
          )}
        </h3>
        {activeFilter && (
          <button
            type="button"
            onClick={() => setActiveFilter("")}
            style={{ fontSize: 12, color: "var(--muted)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
          >
            Clear filter
          </button>
        )}
      </div>

      <table className="data" style={{ tableLayout: "fixed", width: "100%" }}>
        <colgroup>
          <col style={{ width: "40%" }} />
          <col style={{ width: "12%" }} />
          <col style={{ width: "16%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "14%" }} />
        </colgroup>
        <thead>
          <tr>
            <th>Product</th>
            <th>Quantity</th>
            <th>Needed by</th>
            <th>
              <div style={{ display: "flex", alignItems: "center", gap: 6, position: "relative" }}>
                Status
                <div style={{ position: "relative" }}>
                  <button
                    ref={btnRef}
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    title="Filter by status"
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 22, height: 22, borderRadius: 5,
                      background: activeFilter ? "var(--indigo)" : "rgba(0,0,0,0.06)",
                      border: "none", cursor: "pointer",
                      color: activeFilter ? "#fff" : "var(--muted)",
                      transition: "all .15s",
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                    </svg>
                  </button>

                  {dropdownOpen && (
                    <>
                      {/* Backdrop */}
                      <div
                        style={{ position: "fixed", inset: 0, zIndex: 49 }}
                        onClick={() => setDropdownOpen(false)}
                      />
                      <div className="filter-dropdown">
                        {STATUS_OPTIONS.map((opt) => (
                          <div
                            key={opt.value}
                            className={`filter-option${activeFilter === opt.value ? " active" : ""}`}
                            onClick={() => {
                              setActiveFilter(opt.value);
                              setDropdownOpen(false);
                            }}
                          >
                            <span
                              className="filter-dot"
                              style={{
                                background:
                                  opt.value === "awaiting" ? "#3b82f6" :
                                  opt.value === "submitted" ? "#8b5cf6" :
                                  opt.value === "lost" ? "#9ca3af" : "transparent",
                                border: opt.value === "" ? "1.5px solid #d1d5db" : "none",
                              }}
                            />
                            {opt.label}
                            {activeFilter === opt.value && (
                              <svg style={{ marginLeft: "auto" }} width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            )}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)", padding: "20px 0" }}>
                No requests match &ldquo;{activeOption.label}&rdquo;.
              </td>
            </tr>
          ) : (
            filtered.map((r) => (
              <tr key={r.id}>
                <td>
                  <strong>{r.title}</strong>
                  <br />
                  <span className="small muted">{r.category}</span>
                </td>
                <td>{r.quantity ? r.quantity.toLocaleString() : "—"}</td>
                <td>{r.needed_by || "—"}</td>
                <td>
                  {r.quote_status ? (
                    <Badge status={r.quote_status} />
                  ) : (
                    <span className="badge sent">Awaiting quote</span>
                  )}
                </td>
                <td>
                  <Link className="btn sm ghost" href={`/partner/requests/${r.id}`}>
                    {r.quote_id ? "View / revise" : "Quote now"}
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
