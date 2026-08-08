"use client";

import { useState, useEffect, useCallback } from "react";
import { ProposalPanel, type OfferData } from "@/components/ProposalPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProposalOption {
  id: string;
  label: string;
  base_price: number;
  currency: string;
  note?: string | null;
  position: number;
}

interface ProposalRow {
  id: string;
  title: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  status: string;
  sent_via: string | null;
  markup_pct: number;
  delivery_date: string | null;
  delivery_date_to: string | null;
  images: string[];
  comment: string | null;
  token: string;
  created_at: string;
  options: ProposalOption[];
}

interface Props {
  requestId: number;
  requestTitle: string;
  baseOfferData: OfferData;
}

// ── Status pill ───────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  draft:    { bg: "#f1f5f9", color: "#64748b", label: "Draft" },
  sent:     { bg: "#dbeafe", color: "#1d4ed8", label: "Sent" },
  opened:   { bg: "#fef3c7", color: "#b45309", label: "Opened" },
  approved: { bg: "#dcfce7", color: "#15803d", label: "✓ Approved" },
  declined: { bg: "#fee2e2", color: "#b91c1c", label: "Declined" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: "#f1f5f9", color: "#64748b", label: status };
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: 999,
      fontSize: 11, fontWeight: 700, background: s.bg, color: s.color, whiteSpace: "nowrap",
    }}>
      {s.label}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ── Main component ─────────────────────────────────────────────────────────────

export function ClientProposalsTable({ requestId, requestTitle, baseOfferData }: Props) {
  const [proposals, setProposals] = useState<ProposalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openProposalId, setOpenProposalId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function clientLink(token: string) {
    const base =
      (typeof window !== "undefined" && window.location.origin) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      "";
    return `${base.replace(/\/$/, "")}/proposal/${token}`;
  }

  async function copyClientLink(p: ProposalRow) {
    const url = clientLink(p.token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(p.id);
      setTimeout(() => setCopiedId((id) => (id === p.id ? null : id)), 2000);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proposals?request_id=${requestId}`);
      if (!res.ok) return;
      const { proposals: rows } = await res.json();
      setProposals(rows ?? []);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => { load(); }, [load]);

  // Refresh when ProposalPanel saves/sends
  useEffect(() => {
    const handler = () => load();
    window.addEventListener("proposal-saved", handler);
    return () => window.removeEventListener("proposal-saved", handler);
  }, [load]);

  async function handleDelete(id: string) {
    await fetch(`/api/proposals/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    load();
  }

  async function handleDuplicate(p: ProposalRow) {
    setDuplicating(p.id);
    try {
      const payload = {
        request_id: requestId,
        quote_id: null,
        title: `${p.title} (copy)`,
        comment: p.comment ?? "",
        markup_pct: p.markup_pct,
        delivery_date: p.delivery_date,
        delivery_date_to: p.delivery_date_to,
        client_name: p.client_name,
        client_email: p.client_email,
        client_phone: p.client_phone,
        images: p.images ?? [],
        options: p.options.map((o) => ({
          label: o.label,
          base_price: o.base_price,
          currency: o.currency,
          note: o.note ?? null,
        })),
      };
      await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      load();
    } finally {
      setDuplicating(null);
    }
  }

  if (loading) {
    return (
      <div style={{ marginTop: 28 }}>
        <h3 style={{ marginBottom: 12 }}>Client proposals</h3>
        <p className="small muted">Loading…</p>
      </div>
    );
  }

  const openingProposal = openProposalId ? proposals.find((p) => p.id === openProposalId) : null;

  return (
    <div style={{ marginTop: 28 }}>
      <h3 style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
        Client proposals
        <span style={{ fontSize: 12, fontWeight: 700, background: "#e0e7ff", color: "#6366f1", borderRadius: 999, padding: "2px 9px" }}>
          {proposals.length}
        </span>
      </h3>

      {proposals.length === 0 ? (
        <p className="small muted" style={{ marginBottom: 0 }}>
          No client proposals yet — use <strong>Send to client</strong> on a quote to create one.
        </p>
      ) : (
      <div style={{ overflowX: "auto", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,.07)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, background: "#fff" }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              {["Title", "Client", "Options", "Status", "Via", "Created", "Actions"].map((h) => (
                <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#94a3b8", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {proposals.map((p, i) => (
              <tr key={p.id} style={{ borderBottom: i < proposals.length - 1 ? "1px solid #f1f5f9" : "none", background: openProposalId === p.id ? "#fafbff" : undefined }}>

                {/* Title */}
                <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e293b", maxWidth: 180 }}>
                  <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {p.title || "Untitled"}
                  </span>
                </td>

                {/* Client */}
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600, color: "#334155" }}>{p.client_name || "—"}</div>
                  {(p.client_email || p.client_phone) && (
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 1 }}>
                      {p.client_email || p.client_phone}
                    </div>
                  )}
                </td>

                {/* Options count */}
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ fontWeight: 700, color: "#6366f1" }}>{p.options?.length ?? 0}</span>
                </td>

                {/* Status */}
                <td style={{ padding: "10px 14px" }}>
                  <StatusPill status={p.status} />
                </td>

                {/* Sent via */}
                <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
                  {p.sent_via ? (
                    <span style={{ textTransform: "capitalize" }}>
                      {p.sent_via === "both" ? "SMS + Email" : p.sent_via.toUpperCase()}
                    </span>
                  ) : "—"}
                </td>

                {/* Created */}
                <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12, whiteSpace: "nowrap" }}>
                  {fmtDate(p.created_at)}
                </td>

                {/* Actions */}
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "nowrap" }}>

                    {/* Open / Continue */}
                    <button
                      type="button"
                      onClick={() => setOpenProposalId(p.id)}
                      style={{
                        padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: "1.5px solid #6366f1", background: "#eef2ff", color: "#6366f1",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                      }}
                    >
                      {p.status === "draft" ? "Continue" : "Open"}
                    </button>

                    {/* View client link */}
                    <a
                      href={clientLink(p.token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open what the client sees"
                      style={{
                        padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: "1.5px solid #cbd5e1", background: "#fff", color: "#334155",
                        fontFamily: "inherit", whiteSpace: "nowrap", textDecoration: "none",
                      }}
                    >
                      View link
                    </a>
                    <button
                      type="button"
                      onClick={() => copyClientLink(p)}
                      title={clientLink(p.token)}
                      style={{
                        padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        border: "1px solid var(--border)", background: "#fff",
                        color: copiedId === p.id ? "#15803d" : "#64748b",
                        fontFamily: "inherit", whiteSpace: "nowrap",
                      }}
                    >
                      {copiedId === p.id ? "Copied" : "Copy"}
                    </button>

                    {/* Duplicate */}
                    <button
                      type="button"
                      disabled={duplicating === p.id}
                      onClick={() => handleDuplicate(p)}
                      title="Duplicate proposal"
                      style={{
                        padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 13,
                        border: "1px solid var(--border)", background: "#fff", color: "#64748b",
                        fontFamily: "inherit",
                      }}
                    >
                      {duplicating === p.id ? "…" : "⧉"}
                    </button>

                    {/* Delete — 2-click confirmation */}
                    {confirmDelete === p.id ? (
                      <>
                        <button type="button" onClick={() => handleDelete(p.id)}
                          style={{ padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 600, border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontFamily: "inherit" }}>
                          Confirm
                        </button>
                        <button type="button" onClick={() => setConfirmDelete(null)}
                          style={{ padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 12, border: "1px solid var(--border)", background: "#fff", color: "#94a3b8", fontFamily: "inherit" }}>
                          ×
                        </button>
                      </>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(p.id)}
                        title="Delete proposal"
                        style={{ padding: "5px 9px", borderRadius: 7, cursor: "pointer", fontSize: 13, border: "1px solid var(--border)", background: "#fff", color: "#94a3b8", fontFamily: "inherit" }}>
                        ✕
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {/* ProposalPanel opened for a specific existing proposal */}
      {openingProposal && (
        <ProposalPanel
          key={openingProposal.id}
          offer={{ ...baseOfferData, requestTitle }}
          forceOpen
          initialProposalId={openingProposal.id}
          onClose={() => { setOpenProposalId(null); load(); }}
        />
      )}
    </div>
  );
}
