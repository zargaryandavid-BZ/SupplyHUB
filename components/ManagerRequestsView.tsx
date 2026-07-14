"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { RequestRow } from "@/lib/data";
import { STATUS_ORDER, STATUS_LABELS } from "@/lib/types";
import { Badge } from "@/components/Badge";

type ViewMode = "kanban" | "table";

function matchesQuery(r: RequestRow, q: string): boolean {
  if (!q) return true;
  const haystack = [
    r.id,
    r.title,
    r.client_name,
    r.order_number,
    r.category,
    r.specs,
    r.quantity,
    r.needed_by,
    r.status,
    STATUS_LABELS[r.status],
    r.standard_size,
    r.material,
    r.finishing,
    r.width,
    r.height,
    r.depth,
    r.size_unit,
    r.partner_count,
    ...(r.partner_names ?? []),
    r.quote_count,
    r.best_price,
    r.open_questions,
  ]
    .filter((v) => v != null && v !== "")
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function ManagerRequestsView({ requests }: { requests: RequestRow[] }) {
  const [view, setView] = useState<ViewMode>("table");
  const [query, setQuery] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const allStatuses = useMemo(
    () => STATUS_ORDER.filter((s) => requests.some((r) => r.status === s)),
    [requests]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return requests.filter((r) => {
      if (statusFilters.size > 0 && !statusFilters.has(r.status)) return false;
      if (q && !matchesQuery(r, q)) return false;
      return true;
    });
  }, [requests, query, statusFilters]);

  function toggleStatus(s: string) {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  const columns = useMemo(() => {
    return STATUS_ORDER.filter((s) => s !== "closed").concat(
      filtered.some((r) => r.status === "closed") || requests.some((r) => r.status === "closed")
        ? ["closed"]
        : []
    );
  }, [filtered, requests]);

  return (
    <div>
      {/* Top-left: view switch + search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          role="group"
          aria-label="View mode"
          style={{
            display: "inline-flex",
            border: "1px solid var(--border)",
            borderRadius: 8,
            overflow: "hidden",
            background: "#fff",
          }}
        >
          <button
            type="button"
            onClick={() => setView("kanban")}
            aria-pressed={view === "kanban"}
            title="Kanban board"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              border: "none",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              background: view === "kanban" ? "var(--indigo)" : "transparent",
              color: view === "kanban" ? "#fff" : "var(--muted)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="15" rx="1" />
            </svg>
            Board
          </button>
          <button
            type="button"
            onClick={() => setView("table")}
            aria-pressed={view === "table"}
            title="Table view"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 12px",
              border: "none",
              borderLeft: "1px solid var(--border)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              background: view === "table" ? "var(--indigo)" : "transparent",
              color: view === "table" ? "#fff" : "var(--muted)",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
            Table
          </button>
        </div>

        <div style={{ position: "relative", flex: "1 1 280px", maxWidth: 420 }}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted)",
              pointerEvents: "none",
            }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, order #, client, status…"
            aria-label="Filter requests"
            style={{
              width: "100%",
              padding: "8px 32px 8px 34px",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 14,
              fontFamily: "inherit",
              background: "#fff",
              color: "var(--text)",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              title="Clear search"
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--muted)",
                fontSize: 16,
                lineHeight: 1,
                padding: 2,
              }}
            >
              ×
            </button>
          )}
        </div>

        {(query.trim() || statusFilters.size > 0) && (
          <span className="small muted">
            {filtered.length} of {requests.length} request{requests.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            {requests.length === 0
              ? "No requests yet. Create one to get started."
              : "No requests match your search."}
          </p>
        </div>
      ) : view === "kanban" ? (
        <div className="board">
          {columns.map((status) => {
            const items = filtered.filter((r) => r.status === status);
            return (
              <div className="column" key={status}>
                <h4>
                  {STATUS_LABELS[status]} ({items.length})
                </h4>
                {items.length === 0 && (
                  <p className="small muted" style={{ padding: "0 4px" }}>
                    —
                  </p>
                )}
                {items.map((r) => (
                  <Link key={r.id} href={`/manager/requests/${r.id}`} className="req-card">
                    <div className="title">{r.title}</div>
                    <div className="meta">
                      {r.client_name} · {r.order_number}
                      {r.quantity ? ` · qty ${r.quantity.toLocaleString()}` : ""}
                    </div>
                    <div className="stats">
                      {r.partner_count} partner{r.partner_count === 1 ? "" : "s"} ·{" "}
                      {r.quote_count} quote{r.quote_count === 1 ? "" : "s"}
                      {r.best_price != null ? ` · best $${r.best_price.toLocaleString()}` : ""}
                      {r.open_questions > 0 ? ` · ${r.open_questions} Q` : ""}
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Request</th>
              <th>Client</th>
              <th>Order #</th>
              <th>Qty</th>
              <th>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  Status
                  <div ref={filterRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setFilterOpen((o) => !o)}
                      title="Filter by status"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        width: 22, height: 22, padding: 0, border: "none", borderRadius: 4,
                        cursor: "pointer", background: statusFilters.size > 0 ? "var(--indigo)" : "transparent",
                        color: statusFilters.size > 0 ? "#fff" : "var(--muted)",
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                      </svg>
                    </button>
                    {filterOpen && (
                      <div
                        style={{
                          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50,
                          background: "#fff", border: "1px solid var(--border)", borderRadius: 8,
                          boxShadow: "0 4px 16px rgba(0,0,0,0.1)", padding: "6px 0", minWidth: 160,
                        }}
                        onMouseLeave={() => setFilterOpen(false)}
                      >
                        {statusFilters.size > 0 && (
                          <button
                            type="button"
                            onClick={() => { setStatusFilters(new Set()); setFilterOpen(false); }}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "5px 12px", border: "none", background: "none",
                              cursor: "pointer", fontSize: 12, color: "var(--indigo)", fontWeight: 600,
                              fontFamily: "inherit", borderBottom: "1px solid var(--border)", marginBottom: 4,
                            }}
                          >
                            Clear filter
                          </button>
                        )}
                        {allStatuses.map((s) => (
                          <label
                            key={s}
                            style={{
                              display: "flex", alignItems: "center", gap: 8,
                              padding: "5px 12px", cursor: "pointer", fontSize: 13,
                              fontWeight: 400, color: "var(--text)",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={statusFilters.has(s)}
                              onChange={() => toggleStatus(s)}
                              style={{ margin: 0, accentColor: "var(--indigo)" }}
                            />
                            <Badge status={s} />
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                  {statusFilters.size > 0 && (
                    <span style={{
                      fontSize: 10, fontWeight: 700, background: "var(--indigo)", color: "#fff",
                      borderRadius: 10, padding: "1px 5px", lineHeight: 1.5,
                    }}>
                      {statusFilters.size}
                    </span>
                  )}
                </div>
              </th>
              <th>Deliver date</th>
              <th>Partners</th>
              <th>Quotes</th>
              <th>Best price</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const isAwarded = r.status === "awarded";
              return (
                <tr key={r.id}>
                  <td>
                    <Link href={`/manager/requests/${r.id}`}>{r.title}</Link>
                    {r.category ? (
                      <div className="small muted" style={{ marginTop: 2 }}>
                        {r.category}
                      </div>
                    ) : null}
                  </td>
                  <td className="small">{r.client_name || "—"}</td>
                  <td className="small">{r.order_number || "—"}</td>
                  <td className="small">{r.quantity != null ? r.quantity.toLocaleString() : "—"}</td>
                  <td>
                    <Badge status={r.status} />
                  </td>
                  <td className="small">
                    {r.needed_by ? (
                      <span style={isAwarded ? {
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "#fef9c3", color: "#92400e",
                        border: "1px solid #fde68a",
                        borderRadius: 6, padding: "2px 8px",
                        fontWeight: 600, fontSize: 12,
                      } : undefined}>
                        {isAwarded && (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                            <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                          </svg>
                        )}
                        {r.needed_by}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="small">
                    <div style={{ fontWeight: 600 }}>{r.partner_count}</div>
                    {r.partner_names?.length ? (
                      <div className="muted" style={{ marginTop: 2, lineHeight: 1.35 }}>
                        {r.partner_names.join(", ")}
                      </div>
                    ) : null}
                  </td>
                  <td className="small">{r.quote_count}</td>
                  <td className="small">
                    {r.best_price != null ? `$${r.best_price.toLocaleString()}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
