"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfferData {
  quoteId: number | null;
  dispatchId: number;
  requestId: number;
  requestTitle: string;
  partnerName: string;
  basePrice: number | null;
  currency: string;
}

interface ProposalOption {
  tempId: string;
  label: string;
  basePrice: string;
  currency: string;
}

interface SavedProposal {
  id: string;
  title: string;
  comment: string;
  markup_pct: number;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: string;
  approved_option_id: string | null;
  token: string;
  options: Array<{ id: string; label: string; base_price: number; currency: string }>;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  draft:    { label: "Draft",     bg: "#f1f5f9", color: "#64748b" },
  sent:     { label: "Sent to client",     bg: "#eff6ff", color: "#2563eb" },
  approved: { label: "✓ Approved",  bg: "#dcfce7", color: "#16a34a" },
  rejected: { label: "✗ Rejected",  bg: "#fee2e2", color: "#dc2626" },
};

const thStyle: React.CSSProperties = {
  padding: "7px 6px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.4px",
  color: "#94a3b8",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap" as const,
};

// ── Main Component ───────────────────────────────────────────────────────────

interface ProposalPanelProps {
  offer: OfferData;
  fullWidth?: boolean;
}

export function ProposalPanel({ offer, fullWidth }: ProposalPanelProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [proposal, setProposal] = useState<SavedProposal | null>(null);
  const [title, setTitle] = useState(offer.requestTitle);
  const [comment, setComment] = useState("");
  const [markup, setMarkup] = useState(20);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [options, setOptions] = useState<ProposalOption[]>([]);
  const [via, setVia] = useState<"sms" | "email" | "both">("sms");

  // Autocomplete
  const [suggestions, setSuggestions] = useState<Array<{ name: string; email: string; phone: string }>>([]);
  const [showSugg, setShowSugg] = useState(false);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Copy link
  const [copied, setCopied] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // ── Load existing proposal ────────────────────────────────────────────────

  const loadProposal = useCallback(async () => {
    if (!offer.quoteId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/proposals?request_id=${offer.requestId}&quote_id=${offer.quoteId}`);
      const data = await res.json();
      const p: SavedProposal | undefined = data.proposals?.[0];
      if (p) {
        setProposal(p);
        setTitle(p.title || offer.requestTitle);
        setComment(p.comment ?? "");
        setMarkup(Number(p.markup_pct ?? 20));
        setClientName(p.client_name ?? "");
        setClientEmail(p.client_email ?? "");
        setClientPhone(p.client_phone ?? "");
        setOptions(
          (p.options ?? []).map((o) => ({
            tempId: o.id,
            label: o.label,
            basePrice: String(o.base_price),
            currency: o.currency,
          }))
        );
      } else {
        // Default: one option pre-filled from the quote
        setOptions(offer.basePrice != null
          ? [{ tempId: crypto.randomUUID(), label: `${offer.partnerName} quote`, basePrice: String(offer.basePrice), currency: offer.currency }]
          : []
        );
      }
    } finally {
      setLoading(false);
    }
  }, [offer]);

  useEffect(() => {
    if (open) loadProposal();
  }, [open, loadProposal]);

  // ── Autocomplete ──────────────────────────────────────────────────────────

  function searchContacts(q: string) {
    if (acTimer.current) clearTimeout(acTimer.current);
    if (q.length < 2) { setSuggestions([]); return; }
    acTimer.current = setTimeout(async () => {
      const res = await fetch(`/api/client-contacts?q=${encodeURIComponent(q)}`);
      const { contacts } = await res.json();
      setSuggestions(contacts ?? []);
      setShowSugg(true);
    }, 300);
  }

  function applySuggestion(c: { name: string; email: string; phone: string }) {
    setClientName(c.name);
    setClientEmail(c.email ?? "");
    setClientPhone(c.phone ?? "");
    setSuggestions([]);
    setShowSugg(false);
  }

  // ── Options helpers ───────────────────────────────────────────────────────

  function addOption() {
    setOptions((prev) => [...prev, { tempId: crypto.randomUUID(), label: "", basePrice: "", currency: "USD" }]);
  }

  function removeOption(tempId: string) {
    setOptions((prev) => prev.filter((o) => o.tempId !== tempId));
  }

  function updateOption(tempId: string, field: keyof ProposalOption, value: string) {
    setOptions((prev) => prev.map((o) => o.tempId === tempId ? { ...o, [field]: value } : o));
  }

  function finalPrice(basePrice: string, mkp: number): string {
    const n = parseFloat(basePrice);
    if (isNaN(n)) return "—";
    return (n * (1 + mkp / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── Save / Send / Delete ──────────────────────────────────────────────────

  function buildPayload() {
    return {
      id: proposal?.id,
      request_id: offer.requestId,
      quote_id: offer.quoteId,
      title: title.trim(),
      comment: comment.trim() || null,
      markup_pct: markup,
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      options: options.map((o) => ({
        label: o.label.trim(),
        base_price: parseFloat(o.basePrice) || 0,
        currency: o.currency,
      })).filter((o) => o.label),
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const { proposal: saved } = await res.json();
      setProposal(saved);
    } finally {
      setSaving(false);
    }
  }

  async function handleSend() {
    if (!clientName.trim() || (!clientEmail.trim() && !clientPhone.trim())) return;
    setSending(true);
    try {
      // Save first
      const saveRes = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const { proposal: saved } = await saveRes.json();
      setProposal(saved);

      // Then send
      await fetch(`/api/proposals/${saved.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ via }),
      });

      // Save contact
      await fetch("/api/client-contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: clientName.trim(), email: clientEmail.trim() || null, phone: clientPhone.trim() || null }),
      });

      setProposal({ ...saved, status: "sent" });
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    if (!proposal?.id) { setOpen(false); return; }
    await fetch(`/api/proposals/${proposal.id}`, { method: "DELETE" });
    setProposal(null);
    setOpen(false);
  }

  function copyLink() {
    if (!proposal?.token) return;
    navigator.clipboard.writeText(`${baseUrl}/proposal/${proposal.token}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Status badge (shown on offer card, closed state) ─────────────────────

  const statusInfo = proposal ? STATUS_LABEL[proposal.status] : null;

  const isReadOnly = proposal?.status === "approved" || proposal?.status === "rejected";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button + status tag */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexDirection: fullWidth ? "column" : "row", width: fullWidth ? "100%" : undefined }}>
        {statusInfo && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: statusInfo.bg, color: statusInfo.color, whiteSpace: "nowrap",
            alignSelf: fullWidth ? "flex-start" : undefined,
          }}>
            {statusInfo.label}
          </span>
        )}
        <button
          title="Send to client"
          onClick={() => setOpen(true)}
          style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 7,
            cursor: "pointer", padding: fullWidth ? "7px 13px" : "4px 8px",
            display: "inline-flex", width: fullWidth ? "100%" : undefined,
            justifyContent: fullWidth ? "center" : undefined,
            alignItems: "center", gap: 5,
            fontSize: fullWidth ? 13 : 12, fontWeight: 600,
            color: "var(--muted)", fontFamily: "inherit",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/>
            <line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Send to client
        </button>
      </div>

      {/* Modal overlay */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 16, width: "100%", maxWidth: 620,
            maxHeight: "92vh", overflowY: "auto", padding: 28,
            boxShadow: "0 24px 64px rgba(0,0,0,.2)",
          }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>Send to Client</h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 3 }}>
                  Based on {offer.partnerName} quote
                  {statusInfo && (
                    <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--muted)", padding: 4 }}>×</button>
            </div>

            {loading ? (
              <p className="muted" style={{ textAlign: "center", padding: "32px 0" }}>Loading…</p>
            ) : isReadOnly ? (
              /* ── Read-only approved/rejected view ── */
              <ReadOnlyView proposal={proposal!} baseUrl={baseUrl} onCopy={copyLink} copied={copied} />
            ) : (
              /* ── Editable form ── */
              <div>
                {/* Proposal info */}
                <Section label="PROPOSAL">
                  <div className="field">
                    <label>Title *</label>
                    <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={offer.requestTitle} />
                  </div>
                  <div className="field" style={{ marginBottom: 0 }}>
                    <label>Comment <span className="small muted">(optional, visible to client)</span></label>
                    <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add any notes for the client…" style={{ resize: "vertical" }} />
                  </div>
                </Section>

                {/* Client info */}
                <Section label="CLIENT">
                  <div style={{ position: "relative" }}>
                    <div className="field">
                      <label>Name *</label>
                      <input
                        value={clientName}
                        onChange={(e) => { setClientName(e.target.value); searchContacts(e.target.value); }}
                        onFocus={() => clientName.length >= 2 && setShowSugg(true)}
                        onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                        placeholder="Client or company name"
                      />
                    </div>
                    {showSugg && suggestions.length > 0 && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, background: "#fff",
                        border: "1px solid var(--border)", borderRadius: 8, zIndex: 10,
                        boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                      }}>
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            onMouseDown={() => applySuggestion(s)}
                            style={{
                              display: "block", width: "100%", textAlign: "left",
                              padding: "9px 12px", border: "none", background: "none",
                              cursor: "pointer", fontSize: 13, fontFamily: "inherit",
                            }}
                          >
                            <strong>{s.name}</strong>
                            {s.email && <span className="muted"> · {s.email}</span>}
                            {s.phone && <span className="muted"> · {s.phone}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Email</label>
                      <input type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" />
                    </div>
                    <div className="field" style={{ flex: 1 }}>
                      <label>Phone</label>
                      <input type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+1 555 000 0000" />
                    </div>
                  </div>
                </Section>

                {/* Markup */}
                <Section label="MARKUP">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="field" style={{ marginBottom: 0, width: 120 }}>
                      <label>Add-on %</label>
                      <input
                        type="number"
                        min={0}
                        max={1000}
                        step={0.5}
                        value={markup}
                        onChange={(e) => setMarkup(Number(e.target.value))}
                        style={{ textAlign: "right" }}
                      />
                    </div>
                    <p className="small muted" style={{ margin: 0, marginTop: 18 }}>
                      Your prices will be {markup}% above base prices. Only final prices are shown to the client.
                    </p>
                  </div>
                </Section>

                {/* Options — table */}
                <Section label={`PRICE OPTIONS (${options.length})`}>
                  <div style={{ overflowX: "auto", marginBottom: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f8fafc" }}>
                          <th style={thStyle}>Option / Description</th>
                          <th style={{ ...thStyle, width: 110, textAlign: "right" }}>Your cost</th>
                          <th style={{ ...thStyle, width: 64 }}>Cur.</th>
                          <th style={{ ...thStyle, width: 110, textAlign: "right", color: "var(--indigo)" }}>Client price</th>
                          <th style={{ ...thStyle, width: 32 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {options.length === 0 && (
                          <tr>
                            <td colSpan={5} style={{ padding: "14px 10px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>
                              No options yet — click <strong>+ Add row</strong> below
                            </td>
                          </tr>
                        )}
                        {options.map((o, idx) => (
                          <tr key={o.tempId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "4px 6px 4px 0" }}>
                              <input
                                value={o.label}
                                onChange={(e) => updateOption(o.tempId, "label", e.target.value)}
                                placeholder={`Option ${idx + 1}`}
                                style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px" }}>
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={o.basePrice}
                                onChange={(e) => updateOption(o.tempId, "basePrice", e.target.value)}
                                placeholder="0.00"
                                style={{ width: "100%", padding: "6px 8px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, textAlign: "right", fontFamily: "inherit" }}
                              />
                            </td>
                            <td style={{ padding: "4px 6px" }}>
                              <select
                                value={o.currency}
                                onChange={(e) => updateOption(o.tempId, "currency", e.target.value)}
                                style={{ width: "100%", padding: "6px 4px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 13, fontFamily: "inherit" }}
                              >
                                <option>USD</option>
                                <option>EUR</option>
                                <option>GBP</option>
                                <option>CAD</option>
                              </select>
                            </td>
                            <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, color: "var(--indigo)", whiteSpace: "nowrap" }}>
                              {o.currency} {finalPrice(o.basePrice, markup)}
                            </td>
                            <td style={{ padding: "4px 0 4px 4px", textAlign: "center" }}>
                              <button
                                type="button"
                                onClick={() => removeOption(o.tempId)}
                                title="Remove row"
                                style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 16, lineHeight: 1, padding: 2, borderRadius: 4 }}
                              >×</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button type="button" className="btn ghost sm" onClick={addOption}>
                    + Add row
                  </button>
                </Section>

                {/* Send via */}
                {proposal?.status !== "sent" && (
                  <Section label="SEND VIA">
                    <div style={{ display: "flex", gap: 8 }}>
                      {(["sms", "email", "both"] as const).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setVia(v)}
                          style={{
                            padding: "6px 16px", borderRadius: 7, cursor: "pointer",
                            fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                            border: `1.5px solid ${via === v ? "var(--indigo)" : "var(--border)"}`,
                            background: via === v ? "var(--indigo-50)" : "#fff",
                            color: via === v ? "var(--indigo)" : "var(--text)",
                          }}
                        >
                          {v === "sms" ? "SMS" : v === "email" ? "Email" : "SMS + Email"}
                        </button>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Copy link (if sent) */}
                {proposal?.status === "sent" && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Sent ✓ — copy client link:</span>
                    <button className="btn ghost sm" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
                  </div>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 8, flexWrap: "wrap" }}>
                  <div>
                    {proposal?.id && (
                      <button
                        type="button"
                        className="btn danger sm"
                        onClick={handleDelete}
                        style={{ opacity: 0.7 }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={handleSave}
                      disabled={saving}
                    >
                      {saving ? "Saving…" : "Save draft"}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={handleSend}
                      disabled={sending || !clientName.trim() || (!clientEmail.trim() && !clientPhone.trim()) || options.length === 0}
                    >
                      {sending ? "Sending…" : proposal?.status === "sent" ? "Resend" : "Send"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ── Read-only view for approved/rejected proposals ───────────────────────────

function ReadOnlyView({ proposal, baseUrl, onCopy, copied }: {
  proposal: SavedProposal;
  baseUrl: string;
  onCopy: () => void;
  copied: boolean;
}) {
  const approvedOpt = proposal.approved_option_id
    ? proposal.options.find((o) => o.id === proposal.approved_option_id)
    : null;

  return (
    <div>
      {proposal.status === "approved" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#15803d", fontSize: 16, marginBottom: 4 }}>✓ Client approved</div>
          {approvedOpt && (
            <div style={{ fontSize: 14, color: "#166534" }}>
              Selected: <strong>{approvedOpt.label}</strong>
            </div>
          )}
        </div>
      )}
      {proposal.status === "rejected" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "14px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#dc2626", fontSize: 16 }}>✗ Client rejected this proposal</div>
        </div>
      )}
      <div style={{ fontSize: 14, color: "var(--muted)", marginBottom: 12 }}>
        <strong>Client:</strong> {proposal.client_name}
        {proposal.client_email && <> · {proposal.client_email}</>}
        {proposal.client_phone && <> · {proposal.client_phone}</>}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="btn ghost sm" onClick={onCopy}>{copied ? "Copied!" : "Copy approval link"}</button>
      </div>
    </div>
  );
}

// ── Simple section wrapper ───────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)", marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
