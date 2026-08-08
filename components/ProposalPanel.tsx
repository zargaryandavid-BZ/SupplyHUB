"use client";

import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import Image from "next/image";

function SectionLabel({ label, badge }: { label: string; badge?: number }) {
  return (
    <p style={{
      fontSize: 11, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.5px", color: "var(--muted)", margin: "0 0 8px",
      display: "flex", alignItems: "center", gap: 6,
    }}>
      {label}
      {badge != null && (
        <span style={{
          background: "var(--indigo)", color: "#fff",
          borderRadius: 999, fontSize: 10, fontWeight: 700,
          padding: "1px 6px", lineHeight: "16px",
        }}>
          {badge}
        </span>
      )}
    </p>
  );
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface RequestDetails {
  category: string | null;
  quantity: number | null;
  material: string | null;
  finishing: string | null;
  specs: string | null;
  width: number | null;
  height: number | null;
  depth: number | null;
  size_unit: string | null;
  needed_by: string | null;
  attachmentUrls?: { url: string; name: string }[];
}

export interface OfferData {
  quoteId: number | null | undefined;
  dispatchId: number;
  requestId: number;
  requestTitle: string;
  partnerName: string;
  basePrice: number | null;
  currency: string;
  leadTimeDays?: number | null;
  validUntil?: string | null;
  conditions?: string | null;
  // Company branding
  companyName?: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoUrl?: string | null;
  // Request details shown to client
  requestDetails?: RequestDetails;
}

interface ProposalOption {
  tempId: string;
  label: string;
  basePrice: string;
  currency: string;
  note: string;
}

interface SavedProposal {
  id: string;
  title: string;
  comment: string;
  markup_pct: number;
  delivery_date: string | null;
  delivery_date_to: string | null;
  quantity: number | null;
  client_name: string;
  client_email: string;
  client_phone: string;
  status: string;
  approved_option_id: string | null;
  token: string;
  images: string[];
  options: Array<{ id: string; label: string; base_price: number; currency: string; note: string | null }>;
}

const STATUS_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  draft:    { label: "Draft",          bg: "#f1f5f9", color: "#64748b" },
  sent:     { label: "Sent to client", bg: "#eff6ff", color: "#2563eb" },
  approved: { label: "✓ Approved",     bg: "#dcfce7", color: "#16a34a" },
  rejected: { label: "✗ Rejected",     bg: "#fee2e2", color: "#dc2626" },
};

const thStyle: React.CSSProperties = {
  padding: "6px 4px",
  textAlign: "left",
  fontWeight: 700,
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.3px",
  color: "#94a3b8",
  borderBottom: "1px solid #e2e8f0",
  whiteSpace: "nowrap",
  lineHeight: 1.25,
  overflow: "hidden",
  verticalAlign: "bottom",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px",
  border: "1px solid var(--border)",
  borderRadius: 6,
  fontSize: 14,
  fontFamily: "inherit",
  background: "#fff",
  color: "var(--text)",
  textAlign: "left",
};

/** Matches Decline button height/sizing in the client preview */
const btnH: React.CSSProperties = {
  padding: "11px 20px",
  borderRadius: 10,
  fontSize: 14,
  fontFamily: "inherit",
  lineHeight: 1,
  cursor: "pointer",
  fontWeight: 600,
  boxSizing: "border-box",
};

const MAX_PROPOSAL_IMAGES = 4;

function calcFinalPrice(basePrice: string, mkp: number): number | null {
  const n = parseFloat(basePrice);
  if (isNaN(n) || n === 0) return null;
  return Math.round(n * (1 + mkp / 100) * 100) / 100;
}

function fmtPrice(price: number | null, currency: string): string {
  if (price === null) return "—";
  return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function currencySymbol(currency: string): string {
  switch (currency) {
    case "USD": return "$";
    case "EUR": return "€";
    case "GBP": return "£";
    case "CAD": return "C$";
    default: return currency + " ";
  }
}

function fmtMoney(amount: number, currency: string, decimals = true): string {
  const n = decimals
    ? amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : amount.toLocaleString("en-US", { maximumFractionDigits: 0 });
  return `${currencySymbol(currency)}${n}`;
}

function dimStr(r: RequestDetails): string | null {
  const parts = [r.width, r.height, r.depth].filter((v) => v != null);
  if (!parts.length) return null;
  return `${parts.join(" × ")} ${r.size_unit || "mm"}`;
}

// ── Delivery Range Picker ─────────────────────────────────────────────────────

function DeliveryRangePicker({ from, to, onFromChange, onToChange }: {
  from: string; to: string;
  onFromChange: (v: string) => void;
  onToChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const fmt = (d: string) => d ? new Date(d + "T00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
  const label = from ? (to ? `${fmt(from)}  →  ${fmt(to)}` : fmt(from)) : "Select dates…";

  return (
    <div ref={ref} style={{ position: "relative", minWidth: 0, maxWidth: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          maxWidth: "100%", boxSizing: "border-box",
          padding: "4px 8px", borderRadius: 6, cursor: "pointer",
          border: "1px solid #c7d2fe", background: "#eef2ff",
          color: "#6366f1", fontWeight: 600, fontSize: 12,
          fontFamily: "inherit", lineHeight: 1.3,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 200,
          background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,.14)", padding: "16px 18px", minWidth: 280,
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", margin: "0 0 6px" }}>
                Supplier offer date (earliest)
              </p>
              <input
                type="date"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "8px 10px", border: "1.5px solid #c7d2fe",
                  borderRadius: 7, fontSize: 12, fontWeight: 600,
                  color: "#6366f1", background: "#eef2ff", fontFamily: "inherit",
                }}
              />
            </div>
            <div>
              <p style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", margin: "0 0 6px" }}>
                Our delivery date
              </p>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => onToChange(e.target.value)}
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "8px 10px", border: "1.5px solid #e2e8f0",
                  borderRadius: 7, fontSize: 12, fontWeight: 600,
                  color: "#475569", background: "#f8fafc", fontFamily: "inherit",
                }}
              />
            </div>
            {(from || to) && (
              <button
                type="button"
                onClick={() => { onFromChange(""); onToChange(""); }}
                style={{ alignSelf: "flex-start", background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", padding: 0, fontFamily: "inherit" }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function ProposalPanel({ offer, forceOpen, initialProposalId, onClose }: {
  offer: OfferData;
  forceOpen?: boolean;
  initialProposalId?: string;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(forceOpen ?? false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  const [proposal, setProposal] = useState<SavedProposal | null>(null);
  const [title, setTitle] = useState(offer.requestTitle);
  const [comment, setComment] = useState("");
  const [markup, setMarkup] = useState(20);
  const [deliveryDate, setDeliveryDate] = useState(offer.requestDetails?.needed_by ?? "");
  const [deliveryDateTo, setDeliveryDateTo] = useState("");
  const [quantity, setQuantity] = useState(
    offer.requestDetails?.quantity != null ? String(offer.requestDetails.quantity) : ""
  );
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [options, setOptions] = useState<ProposalOption[]>([]);
  const [viaSms,   setViaSms]   = useState(true);
  const [viaEmail, setViaEmail] = useState(false);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);
  const [proposalImages, setProposalImages] = useState<string[]>([]);
  const [usedAttachmentSources, setUsedAttachmentSources] = useState<string[]>([]);
  const [uploadingImg, setUploadingImg] = useState(false);

  const [suggestions, setSuggestions] = useState<Array<{ name: string; email: string; phone: string }>>([]);
  const [showSugg, setShowSugg] = useState(false);
  const acTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copied, setCopied] = useState(false);
  const [sentToast, setSentToast] = useState(false);

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadProposal = useCallback(async () => {
    setLoading(true);
    try {
      let p: SavedProposal | undefined;
      if (initialProposalId) {
        // Load a specific proposal by ID
        const res = await fetch(`/api/proposals/${initialProposalId}`);
        if (res.ok) {
          const data = await res.json();
          p = data.proposal;
        }
      } else if (offer.quoteId) {
        const res = await fetch(`/api/proposals?request_id=${offer.requestId}&quote_id=${offer.quoteId}`);
        const data = await res.json();
        p = data.proposals?.[0];
      }
      if (p) {
        setProposal(p);
        setTitle(p.title || offer.requestTitle);
        setComment(p.comment ?? "");
        setMarkup(Number(p.markup_pct ?? 20));
        setDeliveryDate(p.delivery_date ?? offer.requestDetails?.needed_by ?? "");
        setDeliveryDateTo((p as typeof p & { delivery_date_to?: string | null }).delivery_date_to ?? "");
        setQuantity(
          p.quantity != null
            ? String(p.quantity)
            : offer.requestDetails?.quantity != null
              ? String(offer.requestDetails.quantity)
              : ""
        );
        setClientName(p.client_name ?? "");
        setProposalImages(Array.isArray(p.images) ? (p.images as string[]).slice(0, MAX_PROPOSAL_IMAGES) : []);
        setClientEmail(p.client_email ?? "");
        setClientPhone(p.client_phone ?? "");
        setOptions(
          (p.options ?? []).map((o) => ({
            tempId: o.id,
            label: o.label,
            basePrice: String(o.base_price),
            currency: o.currency,
            note: o.note ?? "",
          }))
        );
      } else {
        // Default option: neutral label (no vendor name exposed)
        setOptions(
          offer.basePrice != null
            ? [{ tempId: crypto.randomUUID(), label: "Option 1", basePrice: String(offer.basePrice), currency: offer.currency, note: "" }]
            : []
        );
      }
    } finally {
      setLoading(false);
    }
  }, [offer]);

  useEffect(() => { if (open) loadProposal(); }, [open, loadProposal]);

  // ── Autocomplete ──────────────────────────────────────────────────────────

  function searchContacts(q: string) {
    if (acTimer.current) clearTimeout(acTimer.current);
    if (q.length < 2) { setSuggestions([]); return; }
    acTimer.current = setTimeout(async () => {
      const { contacts } = await fetch(`/api/client-contacts?q=${encodeURIComponent(q)}`).then((r) => r.json());
      setSuggestions(contacts ?? []);
      setShowSugg(true);
    }, 300);
  }

  function applySuggestion(c: { name: string; email: string; phone: string }) {
    setClientName(c.name); setClientEmail(c.email ?? ""); setClientPhone(c.phone ?? "");
    setSuggestions([]); setShowSugg(false);
  }

  // ── Options ───────────────────────────────────────────────────────────────

  function addOption() {
    setOptions((p) => [...p, { tempId: crypto.randomUUID(), label: "", basePrice: "", currency: offer.currency || "USD", note: "" }]);
  }
  function removeOption(id: string) {
    setOptions((p) => p.filter((o) => o.tempId !== id));
    setSelectedPreviewId((s) => s === id ? null : s);
  }
  function updateOption(id: string, field: keyof ProposalOption, value: string) {
    setOptions((p) => p.map((o) => o.tempId === id ? { ...o, [field]: value } : o));
  }

  // ── Image helpers ─────────────────────────────────────────────────────────

  async function copyAttachmentImage(signedUrl: string) {
    if (proposalImages.length >= MAX_PROPOSAL_IMAGES) return;
    setUploadingImg(true);
    try {
      const { url } = await fetch("/api/proposals/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_url: signedUrl }),
      }).then((r) => r.json());
      if (url) {
        setProposalImages((p) => p.length >= MAX_PROPOSAL_IMAGES ? p : [...p, url as string]);
        // Mark source so the faded + tile disappears (uploaded URL ≠ request URL)
        setUsedAttachmentSources((s) => s.includes(signedUrl) ? s : [...s, signedUrl]);
      }
    } finally { setUploadingImg(false); }
  }

  async function uploadNewImage(file: File) {
    if (proposalImages.length >= MAX_PROPOSAL_IMAGES) return;
    setUploadingImg(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await fetch("/api/proposals/upload-image", { method: "POST", body: fd }).then((r) => r.json());
      if (url) setProposalImages((p) => p.length >= MAX_PROPOSAL_IMAGES ? p : [...p, url as string]);
    } finally { setUploadingImg(false); }
  }

  function removeProposalImage(url: string) {
    setProposalImages((p) => p.filter((u) => u !== url));
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
      delivery_date: deliveryDate.trim() || null,
      delivery_date_to: deliveryDateTo.trim() || null,
      quantity: (() => {
        const n = parseFloat(quantity);
        return !Number.isNaN(n) && n > 0 ? n : null;
      })(),
      client_name: clientName.trim(),
      client_email: clientEmail.trim() || null,
      client_phone: clientPhone.trim() || null,
      images: proposalImages.slice(0, MAX_PROPOSAL_IMAGES),
      options: options
        .map((o) => ({ label: o.label.trim(), base_price: parseFloat(o.basePrice) || 0, currency: o.currency, note: o.note.trim() || null }))
        .filter((o) => o.label),
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
      if (!res.ok) { console.error("Save failed", await res.text()); return; }
      const { proposal: saved } = await res.json();
      if (!saved) { console.error("Save returned empty proposal"); return; }
      setProposal(saved);
      window.dispatchEvent(new Event("proposal-saved"));
    } finally {
      setSaving(false);
      setOpen(false);
      onClose?.();
    }
  }

  async function handleSend() {
    if (!clientName.trim() || (!clientEmail.trim() && !clientPhone.trim())) return;
    setSending(true);
    let succeeded = false;
    try {
      const res = await fetch("/api/proposals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(buildPayload()) });
      if (!res.ok) { console.error("Save failed", await res.text()); return; }
      const { proposal: saved } = await res.json();
      if (!saved?.id) { console.error("Save returned no proposal id"); return; }
      setProposal(saved);
      const via = viaSms && viaEmail ? "both" : viaSms ? "sms" : "email";
      const sendRes = await fetch(`/api/proposals/${saved.id}/send`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ via }) });
      if (!sendRes.ok) { console.error("Send failed", await sendRes.text()); return; }
      await fetch("/api/client-contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: clientName.trim(), email: clientEmail.trim() || null, phone: clientPhone.trim() || null }) });
      setProposal({ ...saved, status: "sent" });
      window.dispatchEvent(new Event("proposal-saved"));
      succeeded = true;
    } finally {
      setSending(false);
      setOpen(false);
      onClose?.();
      if (succeeded) {
        setSentToast(true);
        setTimeout(() => setSentToast(false), 4000);
      }
    }
  }

  async function handleDelete() {
    if (!proposal?.id) { setOpen(false); return; }
    await fetch(`/api/proposals/${proposal.id}`, { method: "DELETE" });
    setProposal(null); setOpen(false);
  }

  function copyLink() {
    if (!proposal?.token) return;
    navigator.clipboard.writeText(`${baseUrl}/proposal/${proposal.token}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  const statusInfo = proposal ? STATUS_LABEL[proposal.status] : null;
  const isReadOnly = proposal?.status === "approved" || proposal?.status === "rejected";

  return (
    <>
      {/* "Sent" toast — shown after modal closes */}
      {sentToast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          zIndex: 9999, background: "#1e293b", color: "#fff",
          padding: "14px 28px", borderRadius: 12,
          boxShadow: "0 8px 32px rgba(0,0,0,.22)",
          display: "flex", alignItems: "center", gap: 12,
          fontSize: 14, fontWeight: 600, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          animation: "fadeInUp .2s ease",
          whiteSpace: "nowrap",
        }}>
          <span style={{ fontSize: 20 }}>✅</span>
          Proposal sent to {clientName || "client"} successfully!
          <button
            onClick={() => setSentToast(false)}
            style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 18, cursor: "pointer", padding: 0, lineHeight: 1, marginLeft: 8 }}
          >×</button>
        </div>
      )}

      {/* Trigger */}
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {statusInfo && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: statusInfo.bg, color: statusInfo.color, whiteSpace: "nowrap" }}>
            {statusInfo.label}
          </span>
        )}
        <button onClick={() => setOpen(true)} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 7, cursor: "pointer", padding: "4px 8px", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--muted)", fontFamily: "inherit" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            <line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>
          </svg>
          Send to client
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1100, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div style={{ background: "#fff", borderRadius: 18, width: "100%", maxWidth: 1280, height: "96vh", display: "flex", flexDirection: "column", boxShadow: "0 32px 80px rgba(0,0,0,.22)", overflow: "hidden" }}>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px 12px", borderBottom: "1px solid #f1f5f9", flexShrink: 0, gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, flexShrink: 0 }}>Send to Client</h2>
                <span style={{ color: "#cbd5e1", flexShrink: 0 }}>|</span>
                {!loading && !isReadOnly ? (
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={offer.requestTitle || "Title *"}
                    size={Math.max((title || offer.requestTitle || "Title").length, 12)}
                    style={{
                      ...inputStyle,
                      width: `${Math.min(Math.max((title || offer.requestTitle || "Title").length, 12), 32)}ch`,
                      flexShrink: 0,
                      fontWeight: 600,
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 280 }}>
                    {title || offer.requestTitle}
                  </span>
                )}
                {!loading && !isReadOnly && proposal?.id && (
                  <button type="button" onClick={handleDelete}
                    style={{ ...btnH, border: "1.5px solid #fca5a5", background: "#fef2f2", color: "#dc2626", flexShrink: 0 }}>
                    Delete
                  </button>
                )}
                {statusInfo && (
                  <span style={{ padding: "1px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusInfo.bg, color: statusInfo.color, flexShrink: 0 }}>
                    {statusInfo.label}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                {!loading && !isReadOnly && (
                  <>
                    <button type="button" onClick={handleSave} disabled={saving}
                      style={{ ...btnH, background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0", opacity: saving ? 0.7 : 1 }}>
                      {saving ? "Saving…" : "Save draft"}
                    </button>

                    {/* Sending options inline */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6, ...btnH, border: "1.5px solid #e2e8f0", background: "#fafafa", color: "var(--text)" }}>
                      <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", marginRight: 4 }}>via</span>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: clientPhone.trim() ? "pointer" : "not-allowed", opacity: clientPhone.trim() ? 1 : 0.4 }}>
                        <input
                          type="checkbox"
                          checked={viaSms}
                          onChange={(e) => setViaSms(e.target.checked)}
                          disabled={!clientPhone.trim()}
                          style={{ width: 14, height: 14, accentColor: "var(--indigo)", cursor: clientPhone.trim() ? "pointer" : "not-allowed" }}
                        />
                        SMS
                      </label>
                      <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: clientEmail.trim() ? "pointer" : "not-allowed", opacity: clientEmail.trim() ? 1 : 0.4 }}>
                        <input
                          type="checkbox"
                          checked={viaEmail}
                          onChange={(e) => setViaEmail(e.target.checked)}
                          disabled={!clientEmail.trim()}
                          style={{ width: 14, height: 14, accentColor: "var(--indigo)", cursor: clientEmail.trim() ? "pointer" : "not-allowed" }}
                        />
                        Email
                      </label>
                    </div>

                    <button type="button" onClick={handleSend}
                      disabled={sending || !clientName.trim() || (!clientEmail.trim() && !clientPhone.trim()) || options.length === 0}
                      style={{
                        ...btnH,
                        background: (sending || !clientName.trim() || (!clientEmail.trim() && !clientPhone.trim()) || options.length === 0) ? "#e2e8f0" : "#6366f1",
                        color: (sending || !clientName.trim() || (!clientEmail.trim() && !clientPhone.trim()) || options.length === 0) ? "#94a3b8" : "#fff",
                        border: "1.5px solid transparent",
                        fontWeight: 700,
                        cursor: (sending || !clientName.trim() || (!clientEmail.trim() && !clientPhone.trim()) || options.length === 0) ? "not-allowed" : "pointer",
                      }}>
                      {sending ? "Sending…" : proposal?.status === "sent" ? "Resend" : "Send"}
                    </button>
                  </>
                )}
                <button onClick={() => { setOpen(false); onClose?.(); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8", padding: 4, lineHeight: 1, marginLeft: 4 }}>×</button>
              </div>
            </div>

            {/* Two-column body */}
            <div style={{ display: "flex", flex: 1, minHeight: 0 }}>

              {/* LEFT: form */}
              <div style={{ flex: "0 0 460px", overflowY: "auto", padding: "18px 22px", borderRight: "1px solid #f1f5f9" }}>
                {loading ? (
                  <p style={{ color: "var(--muted)", textAlign: "center", padding: "40px 0" }}>Loading…</p>
                ) : isReadOnly ? (
                  <ReadOnlyView proposal={proposal!} baseUrl={baseUrl} onCopy={copyLink} copied={copied} />
                ) : (
                  <>
                    <Section label="CLIENT" collapsible>
                      <div style={{ position: "relative" }}>
                        <div className="field">
                          <label>Name *</label>
                          <input value={clientName} onChange={(e) => { setClientName(e.target.value); searchContacts(e.target.value); }}
                            onFocus={() => clientName.length >= 2 && setShowSugg(true)}
                            onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                            placeholder="Client or company name" />
                        </div>
                        {showSugg && suggestions.length > 0 && (
                          <div style={{ position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid var(--border)", borderRadius: 8, zIndex: 20, boxShadow: "0 8px 24px rgba(0,0,0,.12)" }}>
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

                    <Section label="SUPPLIER QUOTE" collapsible>
                      <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                        <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 8, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span>{offer.partnerName}</span>
                          {offer.validUntil && (
                            <>
                              <span style={{ fontWeight: 500, opacity: 0.6 }}>|</span>
                              <span style={{ fontWeight: 600, textTransform: "none", letterSpacing: 0 }}>
                                Valid until {offer.validUntil}
                              </span>
                            </>
                          )}
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 20px", alignItems: "start" }}>
                          <div style={{ minWidth: 0, overflow: "hidden" }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>Delivery window</div>
                            <DeliveryRangePicker
                              from={deliveryDate}
                              to={deliveryDateTo}
                              onFromChange={setDeliveryDate}
                              onToChange={setDeliveryDateTo}
                            />
                          </div>
                          {offer.leadTimeDays != null && (
                            <SupplierField label="Lead time" value={`${offer.leadTimeDays} days`} />
                          )}
                          {offer.basePrice != null && (
                            <SupplierField label="Quoted price" value={fmtMoney(offer.basePrice, offer.currency)} />
                          )}
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>QTY</div>
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              placeholder="—"
                              style={{
                                width: "100%",
                                maxWidth: 120,
                                padding: "4px 8px",
                                border: "1px solid #c7d2fe",
                                borderRadius: 5,
                                fontSize: 12,
                                fontFamily: "inherit",
                                fontWeight: 700,
                                color: "#334155",
                                background: "#fff",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          {offer.conditions && (
                            <div style={{ gridColumn: "1 / -1" }}>
                              <SupplierField label="Conditions" value={offer.conditions} />
                            </div>
                          )}
                        </div>
                      </div>
                    </Section>

                    <Section label={`PRICE OPTIONS (${options.length})`} collapsible>
                      <div style={{ marginBottom: 8 }}>
                        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "auto" }}>
                          <colgroup>
                            <col style={{ width: 140 }} />
                            <col style={{ width: 96 }} />
                            <col style={{ width: 80 }} />
                            <col style={{ width: 110 }} />
                            <col style={{ width: 28 }} />
                          </colgroup>
                          <thead>
                            <tr>
                              <th style={{ ...thStyle, textAlign: "left", padding: "0 0 6px", borderBottom: "1px solid #e2e8f0" }}>Label</th>
                              <th style={{ ...thStyle, textAlign: "left", padding: "0 0 6px", borderBottom: "1px solid #e2e8f0" }}>Vendor $</th>
                              <th style={{ ...thStyle, textAlign: "left", padding: "0 0 6px", borderBottom: "1px solid #e2e8f0" }}>Mkp %</th>
                              <th style={{ ...thStyle, textAlign: "left", padding: "0 0 6px", borderBottom: "1px solid #e2e8f0", color: "#6366f1" }}>Client sees</th>
                              <th style={{ padding: "0 0 6px", borderBottom: "1px solid #e2e8f0" }} />
                            </tr>
                          </thead>
                          <tbody>
                            {options.length === 0 && (
                              <tr>
                                <td colSpan={5} style={{ padding: "12px 0", color: "var(--muted)", fontSize: 13 }}>No options — click + Add new option</td>
                              </tr>
                            )}
                            {options.map((o, idx) => {
                              const fp = calcFinalPrice(o.basePrice, markup);
                              const noteCompact = !o.note.trim();
                              const fieldStyle: React.CSSProperties = {
                                ...inputStyle,
                                width: "100%",
                                height: 40,
                                padding: "0 10px",
                                textAlign: "left",
                                boxSizing: "border-box",
                              };
                              return (
                                <Fragment key={o.tempId}>
                                  <tr>
                                    <td style={{ padding: "6px 8px 0 0", verticalAlign: "middle" }}>
                                      <input
                                        value={o.label}
                                        onChange={(e) => updateOption(o.tempId, "label", e.target.value)}
                                        placeholder={`Option ${idx + 1}`}
                                        style={fieldStyle}
                                      />
                                    </td>
                                    <td style={{ padding: "6px 8px 0 0", verticalAlign: "middle" }}>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={o.basePrice}
                                        onChange={(e) => updateOption(o.tempId, "basePrice", e.target.value)}
                                        placeholder="0.00"
                                        style={fieldStyle}
                                      />
                                    </td>
                                    <td style={{ padding: "6px 8px 0 0", verticalAlign: "middle" }}>
                                      <input
                                        type="text"
                                        inputMode="decimal"
                                        value={markup}
                                        onChange={(e) => setMarkup(Number(e.target.value) || 0)}
                                        style={fieldStyle}
                                      />
                                    </td>
                                    <td style={{ padding: "6px 8px 0 0", verticalAlign: "middle", fontWeight: 700, color: "#6366f1", fontSize: 14, whiteSpace: "nowrap", textAlign: "left" }}>
                                      {fp !== null ? `${o.currency} ${fmtPrice(fp, o.currency)}` : "—"}
                                    </td>
                                    <td style={{ padding: "6px 0 0", verticalAlign: "middle", textAlign: "left" }}>
                                      <button type="button" onClick={() => removeOption(o.tempId)}
                                        style={{ background: "none", border: "none", cursor: "pointer", color: "#cbd5e1", fontSize: 16, lineHeight: 1, padding: 0, height: 40 }}>×</button>
                                    </td>
                                  </tr>
                                  <tr>
                                    <td colSpan={5} style={{ padding: "6px 0 10px" }}>
                                      <textarea
                                        rows={noteCompact ? 2 : 4}
                                        value={o.note}
                                        onChange={(e) => updateOption(o.tempId, "note", e.target.value)}
                                        placeholder="Note for this option (optional)…"
                                        style={{
                                          ...inputStyle,
                                          height: "auto",
                                          background: "#fafbfc",
                                          resize: "vertical",
                                          minHeight: noteCompact ? 48 : 96,
                                          textAlign: "left",
                                        }}
                                      />
                                    </td>
                                  </tr>
                                </Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <button type="button" onClick={addOption}
                        style={{ ...btnH, background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0" }}>
                        + Add new option
                      </button>
                    </Section>


                    {proposal?.status === "sent" && (
                      <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontSize: 13, color: "#15803d", fontWeight: 600 }}>Sent ✓</span>
                        <button type="button" onClick={copyLink}
                          style={{ ...btnH, background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0" }}>
                          {copied ? "Copied!" : "Copy client link"}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT: live preview */}
              <div style={{ flex: 1, overflowY: "auto", background: "#f0f4f8", padding: "18px 20px" }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 12 }}>
                  Client preview — live
                </div>
                <ClientInvoicePreview
                  companyName={offer.companyName ?? ""}
                  companyAddress={offer.companyAddress ?? null}
                  companyPhone={offer.companyPhone ?? null}
                  companyEmail={offer.companyEmail ?? null}
                  logoUrl={offer.logoUrl ?? null}
                  title={title}
                  comment={comment}
                  requestDetails={offer.requestDetails ? {
                    ...offer.requestDetails,
                    quantity: (() => {
                      const n = parseFloat(quantity);
                      return !Number.isNaN(n) && n > 0 ? n : null;
                    })(),
                  } : offer.requestDetails}
                  deliveryDate={deliveryDate}
                  deliveryDateTo={deliveryDateTo}
                  proposalImages={proposalImages}
                  uploadingImg={uploadingImg}
                  onRemoveImage={removeProposalImage}
                  onCopyAttachment={copyAttachmentImage}
                  usedAttachmentSources={usedAttachmentSources}
                  onUploadImage={uploadNewImage}
                  options={options}
                  markup={markup}
                  selectedId={selectedPreviewId}
                  onSelect={setSelectedPreviewId}
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

export function ClientInvoicePreview({
  companyName,
  companyAddress,
  companyPhone,
  companyEmail,
  logoUrl,
  title,
  comment,
  requestDetails,
  deliveryDate,
  deliveryDateTo,
  proposalImages,
  uploadingImg,
  onRemoveImage,
  onCopyAttachment,
  usedAttachmentSources,
  onUploadImage,
  options,
  markup,
  selectedId,
  onSelect,
}: {
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  logoUrl: string | null;
  title: string;
  comment: string;
  requestDetails?: RequestDetails;
  deliveryDate?: string;
  deliveryDateTo?: string;
  proposalImages?: string[];
  uploadingImg?: boolean;
  onRemoveImage?: (url: string) => void;
  onCopyAttachment?: (url: string) => Promise<void>;
  usedAttachmentSources?: string[];
  onUploadImage?: (file: File) => Promise<void>;
  options: ProposalOption[];
  markup: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const validOptions = options.filter((o) => o.label.trim());
  const primaryOption = validOptions[0] ?? null;
  const extraOptions = validOptions.slice(1);
  const dim = requestDetails ? dimStr(requestDetails) : null;


  function CollapseSection({ label, badge, children }: {
    label: string; badge?: string | number; children: React.ReactNode;
  }) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 0", borderBottom: "1px solid #f1f5f9", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8" }}>{label}</span>
          {badge != null && <span style={{ fontSize: 11, fontWeight: 700, background: "#e0e7ff", color: "#6366f1", borderRadius: 999, padding: "1px 7px" }}>{badge}</span>}
        </div>
        {children}
      </div>
    );
  }

  function OptionCard({ opt }: { opt: ProposalOption }) {
    const sel = selectedId === opt.tempId;
    const fp = calcFinalPrice(opt.basePrice, markup);
    const qty = requestDetails?.quantity;
    const ttl = fp != null && qty != null && qty > 0 ? fp * qty : null;
    const priceLabel = fp == null
      ? "—"
      : ttl != null
      ? `Unit Price ${fmtMoney(fp, opt.currency)} | For ${(qty ?? 0).toLocaleString()} units ${fmtMoney(ttl, opt.currency, false)}`
        : `Unit Price ${fmtMoney(fp, opt.currency)}`;
    return (
      <div>
        <button type="button" onClick={() => onSelect(opt.tempId)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "12px 16px", borderRadius: opt.note ? "10px 10px 0 0" : 10, cursor: "pointer", border: `2px solid ${sel ? "#6366f1" : "#e2e8f0"}`, background: sel ? "#f0f0ff" : "#fafafa", textAlign: "left", fontFamily: "inherit", transition: "all .12s", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${sel ? "#6366f1" : "#cbd5e1"}`, background: sel ? "#6366f1" : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {sel && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" strokeWidth="1.5" stroke="white"/></svg>}
            </div>
            <span style={{ fontWeight: 600, fontSize: 14, color: "#1e293b" }}>{opt.label}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 1, minWidth: 0, marginLeft: 10 }}>
            {(deliveryDate || deliveryDateTo) && (
              <span style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600, display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {deliveryDate}{deliveryDate && deliveryDateTo ? " → " : ""}{deliveryDateTo}
              </span>
            )}
            <span style={{ fontWeight: 800, fontSize: 13, color: sel ? "#6366f1" : "#334155", whiteSpace: "nowrap" }}>
              {priceLabel}
            </span>
          </div>
        </button>
        {opt.note && (
          <div style={{ padding: "7px 16px 10px", background: sel ? "#f0f0ff" : "#f8fafc", border: `2px solid ${sel ? "#6366f1" : "#e2e8f0"}`, borderTop: "none", borderRadius: "0 0 10px 10px", fontSize: 12, color: "#64748b", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
            {opt.note}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 24px rgba(0,0,0,.10)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>

      {/* ── Company header ── */}
      <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", padding: "22px 26px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          {logoUrl ? (
            <div style={{ width: 52, height: 52, borderRadius: 10, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
              <Image src={logoUrl} alt={companyName} width={52} height={52} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            </div>
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 10, background: "rgba(255,255,255,.15)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800 }}>
              {(companyName || "B").charAt(0)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2 }}>{companyName || "Your Company"}</div>
            {companyAddress && <div style={{ fontSize: 12, opacity: 0.65, marginTop: 3 }}>{companyAddress}</div>}
            <div style={{ fontSize: 11, opacity: 0.55, marginTop: 4, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              {companyPhone && <span>{companyPhone}</span>}
              {companyEmail && <span>{companyEmail}</span>}
            </div>
          </div>
        </div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.12)", paddingTop: 14 }}>
          <div style={{ fontSize: 10, opacity: 0.55, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>Price Proposal</div>
          <div style={{ fontWeight: 800, fontSize: 20, lineHeight: 1.2 }}>{title || <span style={{ opacity: 0.35 }}>Proposal title…</span>}</div>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ padding: "10px 24px 20px" }}>

        {/* Comment */}
        {comment && (
          <CollapseSection label="Note">
            <div style={{ background: "#f8fafc", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#475569", lineHeight: 1.6, borderLeft: "3px solid #e2e8f0", marginBottom: 4 }}>
              {comment}
            </div>
          </CollapseSection>
        )}

        {/* Primary option — always above product details */}
        {primaryOption ? (
          <CollapseSection label="Your quote">
            <div style={{ marginBottom: 4 }}>
              <OptionCard opt={primaryOption} />
            </div>
          </CollapseSection>
        ) : (
          <CollapseSection label="Your quote">
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "16px", textAlign: "center", color: "#94a3b8", fontSize: 13, marginBottom: 4 }}>
              Add price options on the left →
            </div>
          </CollapseSection>
        )}

        {/* Product details */}
        {requestDetails && (
          <CollapseSection label="Product Details">
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap" }}>
              {/* Left col: data table — one line per row, sizes to content */}
              <div style={{ flex: "1 1 160px", minWidth: 0 }}>
                <table style={{ borderCollapse: "collapse", fontSize: 13, width: "auto" }}>
                  <tbody>
                    {requestDetails.category && <DetailRow label="Product" value={requestDetails.category} />}
                    {requestDetails.quantity != null && <DetailRow label="Quantity" value={requestDetails.quantity.toLocaleString()} />}
                    {dim && <DetailRow label="Dimensions" value={dim} />}
                    {requestDetails.material && <DetailRow label="Material" value={requestDetails.material} />}
                    {requestDetails.finishing && <DetailRow label="Finishing" value={requestDetails.finishing} />}
                    {requestDetails.specs && <DetailRow label="Specs" value={requestDetails.specs} />}
                  </tbody>
                </table>
              </div>
              {/* Right col: images aligned to the right edge */}
              <div style={{ flex: "0 0 auto", marginLeft: "auto" }}>
                {(() => {
                  const IMG = 144;
                  const imgs = (proposalImages ?? []).slice(0, MAX_PROPOSAL_IMAGES);
                  const slotsLeft = MAX_PROPOSAL_IMAGES - imgs.length;
                  const fadedAll = onCopyAttachment
                    ? (requestDetails.attachmentUrls ?? []).filter(
                        (att) => !imgs.includes(att.url) && !(usedAttachmentSources ?? []).includes(att.url)
                      )
                    : [];
                  const faded = fadedAll.slice(0, Math.max(0, slotsLeft - (onUploadImage ? 1 : 0)));
                  const showUpload = !!onUploadImage && imgs.length + faded.length < MAX_PROPOSAL_IMAGES;
                  const tileCount = imgs.length + faded.length + (showUpload ? 1 : 0);
                  const cols = Math.max(1, Math.min(tileCount, MAX_PROPOSAL_IMAGES));
                  const box: React.CSSProperties = {
                    width: IMG,
                    height: IMG,
                    borderRadius: 10,
                    overflow: "hidden",
                    boxSizing: "border-box",
                  };
                  return (
                    <>
                      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${IMG}px)`, gap: 6, justifyContent: "end" }}>
                        {imgs.map((url) => (
                          <div key={url} style={{ ...box, position: "relative", border: "1px solid #e2e8f0" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            {onRemoveImage && (
                              <button type="button" onClick={() => onRemoveImage(url)}
                                style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: "50%", background: "rgba(0,0,0,.55)", border: "none", cursor: "pointer", color: "#fff", fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
                                ×
                              </button>
                            )}
                          </div>
                        ))}
                        {faded.map((att) => (
                          <button key={att.url} type="button" onClick={() => onCopyAttachment!(att.url)}
                            title={`Add "${att.name}" to proposal`} disabled={uploadingImg}
                            style={{ ...box, position: "relative", border: "2px dashed #c7d2fe", background: "none", cursor: uploadingImg ? "wait" : "pointer", padding: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={att.url} alt={att.name} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.45 }} />
                            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <span style={{ fontSize: 22, color: "#6366f1", fontWeight: 800, lineHeight: 1 }}>+</span>
                            </div>
                          </button>
                        ))}
                        {showUpload && (
                          <label style={{ ...box, border: "2px dashed #e2e8f0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: uploadingImg ? "wait" : "pointer", background: "#fafbfc", gap: 2 }}>
                            {uploadingImg
                              ? <span style={{ fontSize: 12, color: "#94a3b8" }}>…</span>
                              : <><span style={{ fontSize: 20, color: "#cbd5e1", lineHeight: 1 }}>↑</span><span style={{ fontSize: 10, color: "#94a3b8" }}>Upload</span></>
                            }
                            <input type="file" accept="image/*" style={{ display: "none" }}
                              onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadImage!(f); e.target.value = ""; }} />
                          </label>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 5, lineHeight: 1.4, textAlign: "right" }}>
                        {imgs.length}/{MAX_PROPOSAL_IMAGES} pics{fadedAll.length > 0 ? " · Faded = request pics" : ""}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </CollapseSection>
        )}

        {/* Extra options — below product details */}
        {extraOptions.length > 0 && (
          <CollapseSection label="More options" badge={extraOptions.length}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 4 }}>
              {extraOptions.map((opt) => (
                <OptionCard key={opt.tempId} opt={opt} />
              ))}
            </div>
          </CollapseSection>
        )}

        {/* Approve / Decline */}
        <CollapseSection label="Actions">
          <div style={{ marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <button type="button" disabled={!selectedId}
                style={{ ...btnH, flex: 1, background: selectedId ? "#6366f1" : "#e2e8f0", color: selectedId ? "#fff" : "#94a3b8", border: "1.5px solid transparent", fontWeight: 800, cursor: selectedId ? "pointer" : "not-allowed" }}>
                Approve
              </button>
              <button type="button"
                style={{ ...btnH, background: "#fff", color: "#94a3b8", border: "1.5px solid #e2e8f0" }}>
                Decline
              </button>
            </div>
            <div style={{ borderTop: "1px dashed #e2e8f0", paddingTop: 12, textAlign: "center" }}>
              <button type="button" style={{ background: "none", border: "none", color: "#94a3b8", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                ↓ Download / Print as PDF
              </button>
            </div>
          </div>
        </CollapseSection>

      </div>
    </div>
  );
}

function SupplierField({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color: highlight ? "#6366f1" : "#334155", fontWeight: highlight ? 700 : 500, lineHeight: 1.4 }}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "3px 0", fontSize: 12, color: "#94a3b8", width: 90, verticalAlign: "middle", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "3px 0 3px 8px", fontSize: 13, color: "#334155", whiteSpace: "nowrap" }}>{value}</td>
    </tr>
  );
}

// ── Read-only view ────────────────────────────────────────────────────────────

function ReadOnlyView({ proposal, baseUrl, onCopy, copied }: { proposal: SavedProposal; baseUrl: string; onCopy: () => void; copied: boolean }) {
  const approvedOpt = proposal.approved_option_id ? proposal.options.find((o) => o.id === proposal.approved_option_id) : null;
  return (
    <div>
      {proposal.status === "approved" && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#15803d", fontSize: 16, marginBottom: 4 }}>✓ Client approved</div>
          {approvedOpt && <div style={{ fontSize: 14, color: "#166534" }}>Selected: <strong>{approvedOpt.label}</strong></div>}
        </div>
      )}
      {proposal.status === "rejected" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
          <div style={{ fontWeight: 800, color: "#dc2626", fontSize: 16 }}>✗ Client rejected</div>
        </div>
      )}
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        <strong>Client:</strong> {proposal.client_name}
        {proposal.client_email && <> · {proposal.client_email}</>}
        {proposal.client_phone && <> · {proposal.client_phone}</>}
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button type="button" onClick={onCopy}
          style={{ ...btnH, background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0" }}>
          {copied ? "Copied!" : "Copy client link"}
        </button>
        <a href={`${baseUrl}/proposal/${proposal.token}`} target="_blank" rel="noreferrer"
          style={{ ...btnH, display: "inline-block", background: "#fff", color: "#374151", border: "1.5px solid #e2e8f0", textDecoration: "none" }}>
          Open ↗
        </a>
      </div>
    </div>
  );
}

function Section({
  label,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  label: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (!collapsible) {
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 10 }}>{label}</div>
        {children}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 18 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "0 0 10px", marginBottom: open ? 0 : 0,
          background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
          borderBottom: open ? "none" : "1px solid #f1f5f9",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8" }}>{label}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform .2s", flexShrink: 0 }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && children}
    </div>
  );
}
