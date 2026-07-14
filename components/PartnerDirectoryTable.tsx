"use client";

import React from "react";
import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import type { Partner } from "@/lib/types";
import type { PartnerActivityRow } from "@/lib/data";
import { Badge } from "@/components/Badge";
import { FeedbackModal } from "@/components/FeedbackModal";

type Stats = { sent: number; won: number; winRate: number };

type Activity = {
  rows: PartnerActivityRow[];
  summary: {
    sent: number;
    responded: number;
    won: number;
    lost: number;
    awaiting: number;
    winRate: number;
    committed: Array<{ currency: string; total: number }>;
    avgRating: number | null;
    feedbackCount: number;
  };
};

function StarsDisplay({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value == null) return <span className="muted">—</span>;
  const full = Math.round(value);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 3 }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ fontSize: 14, color: i < full ? "#f59e0b" : "#d1d5db", lineHeight: 1 }}>★</span>
      ))}
      <span style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginLeft: 4 }}>{value.toFixed(1)}</span>
    </span>
  );
}

export type PartnerDirectoryRow = {
  partner: Partner;
  stats: Stats;
  activity: Activity;
  logoUrl: string | null;
};

function Initials({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const letters =
    parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return <span>{letters.toUpperCase()}</span>;
}

function ChannelPills({ channels }: { channels: string | null }) {
  if (!channels) return <span className="muted">—</span>;
  const list = channels.split(",").map((c) => c.trim()).filter(Boolean);
  return (
    <span style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
      {list.map((c) => (
        <span key={c} className="badge neutral">
          {c}
        </span>
      ))}
    </span>
  );
}

const IconChevron = ({ open }: { open: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", flex: "none" }}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconEdit = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconPause = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="10" y1="15" x2="10" y2="9" />
    <line x1="14" y1="15" x2="14" y2="9" />
  </svg>
);

const IconPlay = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="10 8 16 12 10 16 10 8" />
  </svg>
);

const IconTrash = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);

const IconEye = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

function ProductModal({ partner, onClose }: { partner: { company: string; products?: { name: string; notes?: string; moq: number | null; delivery_days: number | null; price: number | null; currency: string; images?: string[] }[] }; onClose: () => void }) {
  const products = partner.products ?? [];
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(640px, 95vw)", maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          padding: 0, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>{partner.company}</div>
            <div className="small muted">{products.length} product{products.length !== 1 ? "s" : ""}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--muted)", padding: "2px 6px" }}
            title="Close"
          >
            ×
          </button>
        </div>

        {/* Product list */}
        <div style={{ overflowY: "auto", padding: "12px 20px 20px" }}>
          {products.length === 0 ? (
            <p className="small muted" style={{ margin: "16px 0" }}>No products listed for this partner.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {products.map((pr, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid var(--border)", borderRadius: 8,
                    padding: "10px 14px", background: "#fafafa",
                  }}
                >
                  <div style={{ fontWeight: 600, marginBottom: pr.notes ? 4 : 0 }}>{pr.name}</div>
                  {pr.notes && <div className="small muted" style={{ marginBottom: 6 }}>{pr.notes}</div>}
                  <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                    {pr.moq != null && (
                      <span className="small"><span className="muted">MOQ:</span> {pr.moq}</span>
                    )}
                    {pr.delivery_days != null && (
                      <span className="small"><span className="muted">Lead time:</span> {pr.delivery_days} days</span>
                    )}
                    {pr.price != null && (
                      <span className="small"><span className="muted">Price:</span> {pr.currency} {pr.price.toLocaleString()}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivityPanel({
  activity,
  partnerId,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFeedback,
}: {
  activity: Activity;
  partnerId: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFeedback: (fd: FormData) => Promise<any>;
}) {
  const { summary, rows } = activity;
  const [feedbackRow, setFeedbackRow] = useState<PartnerActivityRow | null>(null);

  return (
    <div style={{ padding: "14px 6px" }}>
      {/* Summary stat tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginBottom: 16 }}>
        {(
          [
            { label: "Offers sent", value: <strong style={{ fontSize: 20 }}>{summary.sent}</strong> },
            {
              label: "Responded",
              value: (
                <span style={{ fontSize: 20, fontWeight: 700 }}>
                  {summary.responded}
                  <span className="small muted" style={{ fontWeight: 400, fontSize: 12 }}> ({summary.awaiting} awaiting)</span>
                </span>
              ),
            },
            {
              label: "Won / lost",
              value: (
                <span style={{ fontSize: 20, fontWeight: 700 }}>
                  {summary.won} / {summary.lost}
                  <span className="small muted" style={{ fontWeight: 400, fontSize: 12 }}> ({summary.winRate}%)</span>
                </span>
              ),
            },
            {
              label: "Committed revenue",
              value: (
                <strong style={{ fontSize: 18 }}>
                  {summary.committed.length === 0
                    ? "—"
                    : summary.committed.map((c) => `${c.currency} ${c.total.toLocaleString()}`).join(" · ")}
                </strong>
              ),
            },
            {
              label: "Avg rating",
              value: summary.avgRating != null ? (
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 20, color: "#f59e0b", lineHeight: 1 }}>★</span>
                  <strong style={{ fontSize: 20 }}>{summary.avgRating.toFixed(1)}</strong>
                  <span className="small muted" style={{ fontSize: 12 }}>({summary.feedbackCount})</span>
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 16 }}>—</span>
              ),
            },
          ] as { label: string; value: React.ReactNode }[]
        ).map(({ label, value }) => (
          <div
            key={label}
            style={{
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
            }}
          >
            <div className="small muted" style={{ marginBottom: 4 }}>{label}</div>
            <div>{value}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <p className="small muted">No requests have been sent to this partner yet.</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>Request</th>
              <th>Client / order</th>
              <th>Sent</th>
              <th>Seen</th>
              <th>Qty</th>
              <th>Status</th>
              <th>Total price</th>
              <th>Unit price</th>
              <th>Lead time</th>
              <th>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const unitPrice =
                r.price != null && r.quantity != null && r.quantity > 0
                  ? r.price / r.quantity
                  : null;
              const isWon = r.quote_status === "won";
              const hasFeedback = r.feedback_id != null;
              const dimAvg = hasFeedback
                ? (() => {
                    const dims = [r.quality_rating, r.quantity_rating, r.satisfaction_rating, r.timing_rating]
                      .filter((v): v is number => v != null);
                    return dims.length > 0 ? dims.reduce((a, b) => a + b, 0) / dims.length : null;
                  })()
                : null;
              return (
                <tr key={r.dispatch_id} style={isWon ? { background: "#fffbeb" } : undefined}>
                  <td>
                    <Link href={`/manager/requests/${r.request_id}`}>{r.request_title}</Link>
                  </td>
                  <td className="small">{r.client_name} · {r.order_number}</td>
                  <td className="small">
                    {r.sent_at
                      ? new Date(r.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : "—"}
                  </td>
                  <td className="small">
                    {r.seen_at ? (
                      <span title={new Date(r.seen_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} style={{ color: "#16a34a", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        {new Date(r.seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    ) : (
                      <span className="muted">Not seen</span>
                    )}
                  </td>
                  <td className="small">{r.quantity != null ? r.quantity.toLocaleString() : "—"}</td>
                  <td>
                    {r.quote_status ? (
                      <Badge status={r.quote_status} />
                    ) : (
                      <span className="small muted">Awaiting quote…</span>
                    )}
                  </td>
                  <td className="small">
                    {r.price != null ? `${r.currency ?? "$"} ${r.price.toLocaleString()}` : "—"}
                  </td>
                  <td className="small">
                    {unitPrice != null
                      ? `${r.currency ?? "$"} ${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </td>
                  <td className="small">
                    {r.lead_time_days != null ? `${r.lead_time_days} days` : "—"}
                  </td>
                  <td>
                    {isWon ? (
                      <button
                        type="button"
                        onClick={() => setFeedbackRow(r)}
                        style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          background: hasFeedback ? "#fef3c7" : "var(--indigo)",
                          color: hasFeedback ? "#92400e" : "#fff",
                          border: hasFeedback ? "1px solid #fcd34d" : "none",
                          borderRadius: 6, padding: "4px 10px",
                          cursor: "pointer", fontSize: 12, fontWeight: 600,
                          fontFamily: "inherit", whiteSpace: "nowrap",
                        }}
                        title={hasFeedback ? "Edit feedback" : "Add feedback"}
                      >
                        {hasFeedback ? (
                          <>
                            <span style={{ color: "#f59e0b" }}>★</span>
                            {dimAvg != null ? dimAvg.toFixed(1) : "Edit"}
                          </>
                        ) : (
                          <>+ Feedback</>
                        )}
                      </button>
                    ) : (
                      <span className="small muted">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Feedback modal */}
      {feedbackRow && (
        <FeedbackModal
          requestTitle={feedbackRow.request_title}
          dispatchId={feedbackRow.dispatch_id}
          partnerId={partnerId}
          requestId={feedbackRow.request_id}
          existing={
            feedbackRow.feedback_id != null
              ? {
                  quality_rating: feedbackRow.quality_rating,
                  quantity_rating: feedbackRow.quantity_rating,
                  satisfaction_rating: feedbackRow.satisfaction_rating,
                  timing_rating: feedbackRow.timing_rating,
                  feedback_notes: feedbackRow.feedback_notes,
                }
              : null
          }
          saveFeedback={saveFeedback}
          onClose={() => setFeedbackRow(null)}
        />
      )}
    </div>
  );
}

export function PartnerDirectoryTable({
  rows,
  deletePartner,
  togglePartnerActive,
  saveFeedback,
}: {
  rows: PartnerDirectoryRow[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deletePartner: (formData: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  togglePartnerActive: (formData: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFeedback: (formData: FormData) => Promise<any>;
}) {
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [productFilter, setProductFilter] = useState("");
  const [previewPartner, setPreviewPartner] = useState<(typeof rows)[0]["partner"] | null>(null);

  function toggle(id: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Collect all unique product names for the datalist
  const allProductNames = useMemo(() => {
    const seen = new Set<string>();
    for (const { partner } of rows) {
      for (const pr of partner.products ?? []) {
        if (pr.name.trim()) seen.add(pr.name.trim());
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  // Filter rows by product name
  const filteredRows = useMemo(() => {
    const q = productFilter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ partner }) =>
      (partner.products ?? []).some((pr) => pr.name.toLowerCase().includes(q))
    );
  }, [rows, productFilter]);

  return (
    <>
      {previewPartner && (
        <ProductModal partner={previewPartner} onClose={() => setPreviewPartner(null)} />
      )}
      {/* Toolbar: filter + add partner */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ position: "relative", flex: "0 1 320px" }}>
          <svg
            width="15" height="15" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--muted)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            list="product-names-list"
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            placeholder="Filter by product…"
            style={{
              width: "100%", padding: "8px 32px 8px 34px",
              border: "1px solid var(--border)", borderRadius: 8,
              fontSize: 14, fontFamily: "inherit", background: "#fff", color: "var(--text)",
            }}
          />
          {productFilter && (
            <button
              type="button"
              onClick={() => setProductFilter("")}
              title="Clear filter"
              style={{
                position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                color: "var(--muted)", fontSize: 16, lineHeight: 1, padding: 2,
              }}
            >
              ×
            </button>
          )}
          <datalist id="product-names-list">
            {allProductNames.map((name) => <option key={name} value={name} />)}
          </datalist>
        </div>

        {productFilter && (
          <span className="small muted">
            {filteredRows.length} of {rows.length} partner{rows.length !== 1 ? "s" : ""}
          </span>
        )}
        </div>{/* end left group */}

        <Link href="/manager/partners/new" className="btn" style={{ flexShrink: 0, whiteSpace: "nowrap" }}>
          + Add partner
        </Link>
      </div>

    <table className="data">
      <thead>
        <tr>
          <th>Company</th>
          <th>Contact</th>
          <th>Location</th>
          <th>Products</th>
          <th>Avg delivery</th>
          <th>Channels</th>
          <th>Win rate</th>
          <th>Rating</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {filteredRows.length === 0 && (
          <tr>
            <td colSpan={8} style={{ textAlign: "center", color: "var(--muted)", padding: "28px 0" }}>
              No partners offer &ldquo;{productFilter}&rdquo;.
            </td>
          </tr>
        )}
        {filteredRows.map(({ partner: p, stats: s, activity, logoUrl }) => {
          const inactive = p.active !== 1;
          const isOpen = expanded.has(p.id);
          return (
            <Fragment key={p.id}>
              <tr style={inactive ? { opacity: 0.55 } : undefined}>
                <td>
                  <button
                    type="button"
                    onClick={() => toggle(p.id)}
                    className="partner-cell"
                    title={isOpen ? "Hide activity" : "Show activity"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      background: "none",
                      border: "none",
                      padding: 0,
                      cursor: "pointer",
                      textAlign: "left",
                      font: "inherit",
                      color: "inherit",
                    }}
                  >
                    <IconChevron open={isOpen} />
                    <div className="avatar">
                      {logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={logoUrl}
                          alt={p.company}
                        />
                      ) : (
                        <Initials name={p.company} />
                      )}
                    </div>
                    <div>
                      <strong>{p.company}</strong>
                      {inactive && (
                        <>
                          {" "}
                          <span className="badge inactive">Deactivated</span>
                        </>
                      )}
                      <div className="small muted">{p.portal_email || p.email || "—"}</div>
                    </div>
                  </button>
                </td>
                <td>{p.portal_contact_name || p.contact || "—"}</td>
                <td className="small">{p.location || "—"}</td>
                <td className="small" style={{ maxWidth: 220 }}>
                  {p.products && p.products.length > 0 ? (
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.products.map((pr) => pr.name).join(", ")}
                    </span>
                  ) : p.categories ? (
                    <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} className="muted">
                      {p.categories.split(",").map((c) => c.trim()).join(", ")}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td className="small">
                  {p.avg_delivery_days ? `${p.avg_delivery_days} days` : "—"}
                </td>
                <td>
                  <ChannelPills channels={p.preferred_channels} />
                </td>
                <td>
                  {s.sent > 0 ? `${s.winRate}%` : "—"}
                  {s.sent > 0 && <span className="small muted"> ({s.sent})</span>}
                </td>
                <td>
                  <StarsDisplay value={activity.summary.avgRating} />
                  {activity.summary.feedbackCount > 0 && (
                    <div className="small muted" style={{ marginTop: 2 }}>
                      {activity.summary.feedbackCount} review{activity.summary.feedbackCount !== 1 ? "s" : ""}
                    </div>
                  )}
                </td>
                <td>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn ghost icon"
                      title="View products"
                      onClick={() => setPreviewPartner(p)}
                    >
                      <IconEye />
                    </button>
                    <Link
                      href={`/manager/partners/${p.id}/edit`}
                      className="btn ghost icon"
                      title="Edit partner"
                    >
                      <IconEdit />
                    </Link>

                    {inactive ? (
                      <form action={togglePartnerActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value="1" />
                        <button className="btn green icon" type="submit" title="Reactivate partner">
                          <IconPlay />
                        </button>
                      </form>
                    ) : (
                      <form action={togglePartnerActive}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value="0" />
                        <button className="btn ghost icon" type="submit" title="Deactivate partner">
                          <IconPause />
                        </button>
                      </form>
                    )}

                    {s.sent > 0 ? (
                      <span
                        className="btn ghost icon"
                        title={`Cannot delete — ${p.company} has ${s.sent} request${s.sent !== 1 ? "s" : ""} on record. Deactivate instead.`}
                        style={{ opacity: 0.35, cursor: "not-allowed" }}
                      >
                        <IconTrash />
                      </span>
                    ) : (
                      <details style={{ display: "inline-block", position: "relative" }}>
                        <summary
                          className="btn danger icon"
                          style={{ cursor: "pointer", listStyle: "none" }}
                          title="Delete partner"
                        >
                          <IconTrash />
                        </summary>
                        <div
                          className="card"
                          style={{
                            position: "absolute",
                            zIndex: 10,
                            right: 0,
                            top: "100%",
                            marginTop: 6,
                            minWidth: 220,
                            padding: "12px 14px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                          }}
                        >
                          <p className="small" style={{ margin: "0 0 10px" }}>
                            Permanently delete <strong>{p.company}</strong>?
                          </p>
                          <form action={deletePartner}>
                            <input type="hidden" name="id" value={p.id} />
                            <button className="btn sm danger" type="submit">
                              Yes, delete
                            </button>
                          </form>
                        </div>
                      </details>
                    )}
                  </div>
                </td>
              </tr>
              {isOpen && (
                <tr>
                  <td colSpan={9} style={{ background: "#fafafa", padding: "0 16px" }}>
                    <ActivityPanel
                      activity={activity}
                      partnerId={p.id}
                      saveFeedback={saveFeedback}
                    />
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
    </>
  );
}
