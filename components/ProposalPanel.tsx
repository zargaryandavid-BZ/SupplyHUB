"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OfferData {
  quoteId: number | null;
  dispatchId: number;
  requestId: number;
  requestTitle: string;
  partnerName: string;
  basePrice: number | null;
  currency: string;
  companyName?: string;
  logoUrl?: string | null;
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
  draft:    { label: "Draft",        bg: "#f1f5f9", color: "#64748b" },
  sent:     { label: "Sent to client", bg: "#eff6ff", color: "#2563eb" },
  approved: { label: "✓ Approved",   bg: "#dcfce7", color: "#16a34a" },
  rejected: { label: "✗ Rejected",   bg: "#fee2e2", color: "#dc2626" },
};

const thStyle: React.CSSProperties = {
  padding: "7px 6px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  color: "#94a3b8",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
};

function finalPrice(basePrice: string, mkp: number): string {
  const n = parseFloat(basePrice);
  if (isNaN(n) || n === 0) return "—";
  return (n * (1 + mkp / 100)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ── Main Component ───────────────────────────────────────────────────────────

interface ProposalPanelProps {
  offer: OfferData;
}

export function ProposalPanel({ offer }: ProposalPanelProps) {
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
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);

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
        setOptions(
          offer.basePrice != null
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
    setSelectedPreviewId((id) => id === tempId ? null : id);
  }

  function updateOption(tempId: string, field: keyof ProposalOption, value: string) {
    setOptions((prev) => prev.map((o) => o.tempId === tempId ? { ...o, [field]: value } : o));
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
      options: options
        .map((o) => ({ label: o.label.trim(), base_price: parseFloat(o.basePrice) || 0, currency: o.currency }))
        .filter((o) => o.label),
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
      const saveRes = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const { proposal: saved } = await saveRes.json();
      setProposal(saved);

      await fetch(`/api/proposals/${saved.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ via }),
      });

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

  const statusInfo = proposal ? STATUS_LABEL[proposal.status] : null;
  const isReadOnly = proposal?.status === "approved" || proposal?.status === "rejected";

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, width: "100%" }}>
        {statusInfo && (
          <span style={{
            fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
            background: statusInfo.bg, color: statusInfo.color, whiteSpace: "nowrap",
            alignSelf: "flex-start",
          }}>
            {statusInfo.label}
          </span>
        )}
        <button
          title="Send to client"
          onClick={() => setOpen(true)}
          style={{
            background: "none", border: "1px solid var(--border)", borderRadius: 7,
            cursor: "pointer", padding: "7px 13px", display: "flex",
            width: "100%", justifyContent: "center",
            alignItems: "center", gap: 5, fontSize: 13, fontWeight: 600,
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

      {/* Modal */}
      {open && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
            zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div style={{
            background: "#fff", borderRadius: 18, width: "100%", maxWidth: 980,
            maxHeight: "94vh", display: "flex", flexDirection: "column",
            boxShadow: "0 32px 80px rgba(0,0,0,.22)",
            overflow: "hidden",
          }}>
            {/* Modal header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 28px 14px", borderBottom: "1px solid #f1f5f9", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Send to Client</h2>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                  Based on {offer.partnerName} quote
                  {statusInfo && (
                    <span style={{ marginLeft: 8, padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusInfo.bg, color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                  )}
                </div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", padding: 4, lineHeight: 1 }}>×</button>
            </div>

            {/* Two-column body */}
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

              {/* ── LEFT: Form ── */}
              <div style={{ flex: "0 0 420px", overflowY: "auto", padding: "20px 24px", borderRight: "1px solid #f1f5f9" }}>
                {loading ? (
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Loading…</p>
                ) : isReadOnly ? (
                  <ReadOnlyView proposal={proposal!} baseUrl={baseUrl} onCopy={copyLink} copied={copied} />
                ) : (
                  <div>
                    <Section label="PROPOSAL">
                      <div className="field">
                        <label>Title *</label>
                        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={offer.requestTitle} />
                      </div>
                      <div className="field" style={{ marginBottom: 0 }}>
                        <label>Comment <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 400 }}>(optional, visible to client)</span></label>
                        <textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add any notes for the client…" style={{ resize: "vertical" }} />
                      </div>
                    </Section>

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
                            border: "1px solid var(--border)", borderRadius: 8, zIndex: 20,
                            boxShadow: "0 8px 24px rgba(0,0,0,.12)",
                          }}>
                            {suggestions.map((s, i) => (
                              <button key={i} type="button" onMouseDown={() => applySuggestion(s)}
                                style={{ display: "block", width: "100%", textAlign: "left", padding: "9px 12px", border: "none", background: "none", cursor: "pointer", fontSize: 13, fontFamily: "inherit" }}>
                                <strong>{s.name}</strong>
                                {s.email && <span style={{ color: "var(--muted)" }}> · {s.email}</span>}
                                {s.phone && <span style={{ color: "var(--muted)" }}> · {s.phone}</span>}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
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

                    <Section label="MARKUP">
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div className="field" style={{ marginBottom: 0, width: 110 }}>
                          <label>Add-on %</label>
                          <input type="number" min={0} max={1000} step={0.5} value={markup}
                            onChange={(e) => setMarkup(Number(e.target.value))} style={{ textAlign: "right" }} />
                        </div>
                        <p style={{ margin: 0, marginTop: 18, fontSize: 12, color: "var(--muted)" }}>
                          Client sees final prices only — base cost is hidden.
                        </p>
                      </div>
                    </Section>

                    <Section label={`PRICE OPTIONS (${options.length})`}>
                      <div style={{ overflowX: "auto", marginBottom: 8 }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: "#f8fafc" }}>
                              <th style={thStyle}>Option / Description</th>
                              <th style={{ ...thStyle, width: 100, textAlign: "right" }}>Your cost</th>
                              <th style={{ ...thStyle, width: 60 }}>Cur.</th>
                              <th style={{ ...thStyle, width: 90, textAlign: "right", color: "#6366f1" }}>Client price</th>
                              <th style={{ ...thStyle, width: 28 }}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {options.length === 0 && (
                              <tr><td colSpan={5} style={{ padding: "12px 6px", color: "var(--muted)", fontSize: 13, textAlign: "center" }}>No options — click + Add row</td></tr>
                            )}
                            {options.map((o, idx) => (
                              <tr key={o.tempId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "4px 4px 4px 0" }}>
                                  <input value={o.label} onChange={(e) => updateOption(o.tempId, "label", e.target.value)}
                                    placeholder={`Option ${idx + 1}`}
                                    style={{ width: "100%", padding: "5px 7px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }} />
                                </td>
                                <td style={{ padding: "4px 4px" }}>
                                  <input type="number" min={0} step={0.01} value={o.basePrice}
                                    onChange={(e) => updateOption(o.tempId, "basePrice", e.target.value)}
                                    placeholder="0.00"
                                    style={{ width: "100%", padding: "5px 7px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, textAlign: "right", fontFamily: "inherit" }} />
                                </td>
                                <td style={{ padding: "4px 4px" }}>
                                  <select value={o.currency} onChange={(e) => updateOption(o.tempId, "currency", e.target.value)}
                                    style={{ width: "100%", padding: "5px 3px", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontFamily: "inherit" }}>
                                    <option>USD</option><option>EUR</option><option>GBP</option><option>CAD</option>
                                  </select>
                                </td>
                                <td style={{ padding: "4px", textAlign: "right", fontWeight: 700, color: "#6366f1", fontSize: 12, whiteSpace: "nowrap" }}>
                                  {o.currency} {finalPrice(o.basePrice, markup)}
                                </td>
                                <td style={{ padding: "4px 0 4px 2px", textAlign: "center" }}>
                                  <button type="button" onClick={() => removeOption(o.tempId)}
                                    style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 15, lineHeight: 1, padding: 2 }}>×</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" className="btn ghost sm" onClick={addOption}>+ Add row</button>
                    </Section>

                    {proposal?.status !== "sent" && (
                      <Section label="SEND VIA">
                        <div style={{ display: "flex", gap: 8 }}>
                          {(["sms", "email", "both"] as const).map((v) => (
                            <button key={v} type="button" onClick={() => setVia(v)}
                              style={{
                                padding: "6px 14px", borderRadius: 7, cursor: "pointer",
                                fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                                border: `1.5px solid ${via === v ? "#6366f1" : "var(--border)"}`,
                                background: via === v ? "#eef2ff" : "#fff",
                                color: via === v ? "#6366f1" : "var(--text)",
                              }}>
                              {v === "sms" ? "SMS" : v === "email" ? "Email" : "SMS + Email"}
                            </button>
                          ))}
                        </div>
                      </Section>
                    )}

                    {proposal?.status === "sent" && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Sent ✓ — copy client link:</span>
                        <button className="btn ghost sm" onClick={copyLink}>{copied ? "Copied!" : "Copy link"}</button>
                      </div>
                    )}

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 10, justifyContent: "space-between", flexWrap: "wrap", paddingTop: 4 }}>
                      <div>
                        {proposal?.id && (
                          <button type="button" onClick={handleDelete}
                            style={{ padding: "7px 14px", borderRadius: 7, cursor: "pointer", border: "1px solid #fca5a5", background: "#fef2f2", color: "#dc2626", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>
                            Delete
                          </button>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button type="button" className="btn ghost" onClick={() => setOpen(false)}>Cancel</button>
                        <button type="button" className="btn ghost sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save draft"}</button>
                        <button type="button" className="btn" onClick={handleSend}
                          disabled={sending || !clientName.trim() || (!clientEmail.trim() && !clientPhone.trim()) || options.length === 0}>
                          {sending ? "Sending…" : proposal?.status === "sent" ? "Resend" : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── RIGHT: Live invoice preview ── */}
              <div style={{ flex: 1, overflowY: "auto", background: "#f0f4f8", padding: "20px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 12 }}>
                  Client preview — live
                </div>
                <ClientInvoicePreview
                  companyName={offer.companyName ?? ""}
                  logoUrl={offer.logoUrl ?? null}
                  title={title}
                  comment={comment}
                  clientName={clientName}
                  options={options}
                  markup={markup}
                  selectedId={selectedPreviewId}
                  onSelect={setSelectedPreviewId}
                  isReadOnly={isReadOnly}
                />
              </div>

            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Live Client Invoice Preview ───────────────────────────────────────────────

function ClientInvoicePreview({
  companyName,
  logoUrl,
  title,
  comment,
  clientName,
  options,
  markup,
  selectedId,
  onSelect,
  isReadOnly,
}: {
  companyName: string;
  logoUrl: string | null;
  title: string;
  comment: string;
  clientName: string;
  options: ProposalOption[];
  markup: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isReadOnly: boolean;
}) {
  const validOptions = options.filter((o) => o.label.trim());

  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      overflow: "hidden",
      boxShadow: "0 4px 24px rgba(0,0,0,.10)",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* Invoice header */}
      <div style={{
        background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
        padding: "24px 28px",
        color: "#fff",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          {logoUrl ? (
            <div style={{ width: 44, height: 44, borderRadius: 10, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
              <Image src={logoUrl} alt={companyName} width={44} height={44} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          ) : (
            <div style={{ width: 44, height: 44, borderRadius: 10, background: "rgba(255,255,255,.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff" }}>
              {(companyName || "B").charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>{companyName || "Your Company"}</div>
          </div>
        </div>
        <div style={{ fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Price Proposal for</div>
        <div style={{ fontWeight: 800, fontSize: 18, lineHeight: 1.2 }}>{title || <span style={{ opacity: 0.4 }}>Proposal title…</span>}</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>Hi, {clientName || <span style={{ opacity: 0.5 }}>Client name…</span>}</div>
      </div>

      {/* Body */}
      <div style={{ padding: "20px 24px 24px" }}>
        {comment && (
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", marginBottom: 18, fontSize: 13, color: "#475569", lineHeight: 1.6, borderLeft: "3px solid #e2e8f0" }}>
            {comment}
          </div>
        )}

        {validOptions.length > 0 ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "#94a3b8", marginBottom: 10 }}>
              {validOptions.length === 1 ? "Your quote" : "Choose an option"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {validOptions.map((opt) => {
                const sel = selectedId === opt.tempId;
                const fp = parseFloat(opt.basePrice);
                const priceNum = isNaN(fp) || fp === 0 ? null : fp * (1 + markup / 100);
                const priceStr = priceNum
                  ? priceNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  : "—";
                return (
                  <button key={opt.tempId} type="button"
                    onClick={() => !isReadOnly && onSelect(opt.tempId)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 16px", borderRadius: 10, cursor: isReadOnly ? "default" : "pointer",
                      border: `2px solid ${sel ? "#6366f1" : "#e2e8f0"}`,
                      background: sel ? "#f0f0ff" : "#fafafa",
                      textAlign: "left", fontFamily: "inherit", transition: "all .12s",
                    }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%",
                        border: `2px solid ${sel ? "#6366f1" : "#cbd5e1"}`,
                        background: sel ? "#6366f1" : "#fff",
                        flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {sel && <svg width="9" height="9" viewBox="0 0 10 10" fill="white"><path d="M2 5l2 2 4-4" strokeWidth="1.5" stroke="white" fill="none"/></svg>}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{opt.label}</span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: 14, color: sel ? "#6366f1" : "#334155", flexShrink: 0, marginLeft: 10 }}>
                      {opt.currency} {priceStr}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div style={{ background: "#f8fafc", borderRadius: 10, padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: 13, marginBottom: 18 }}>
            Add price options on the left →
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button"
            disabled={!selectedId}
            style={{
              flex: 1, padding: "12px 0", borderRadius: 10,
              background: selectedId ? "#6366f1" : "#e2e8f0",
              color: selectedId ? "#fff" : "#94a3b8",
              border: "none", fontWeight: 800, fontSize: 15, fontFamily: "inherit",
              cursor: selectedId ? "pointer" : "not-allowed",
            }}>
            Approve
          </button>
          <button type="button"
            style={{
              padding: "12px 20px", borderRadius: 10,
              background: "#fff", color: "#94a3b8",
              border: "1.5px solid #e2e8f0", fontWeight: 600, fontSize: 14, fontFamily: "inherit",
              cursor: "pointer",
            }}>
            Decline
          </button>
        </div>

        <div style={{ marginTop: 14, borderTop: "1px dashed #e2e8f0", paddingTop: 14, textAlign: "center" }}>
          <button type="button"
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
            ↓ Download / Print as PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Read-only approved/rejected view ─────────────────────────────────────────

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
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#15803d", fontSize: 16, marginBottom: 4 }}>✓ Client approved</div>
          {approvedOpt && (
            <div style={{ fontSize: 14, color: "#166534" }}>
              Selected: <strong>{approvedOpt.label}</strong>
            </div>
          )}
        </div>
      )}
      {proposal.status === "rejected" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#dc2626", fontSize: 16 }}>✗ Client rejected this proposal</div>
        </div>
      )}
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        <strong>Client:</strong> {proposal.client_name}
        {proposal.client_email && <> · {proposal.client_email}</>}
        {proposal.client_phone && <> · {proposal.client_phone}</>}
      </div>
      <button className="btn ghost sm" onClick={onCopy}>{copied ? "Copied!" : "Copy approval link"}</button>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 10 }}>
        {label}
      </div>
      {children}
    </div>
  );
}
