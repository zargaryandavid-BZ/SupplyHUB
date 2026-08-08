"use client";

import { useState } from "react";
import Image from "next/image";

interface ProposalOption {
  id: string;
  label: string;
  currency: string;
  note: string | null;
  final_price: number;
}

interface RequestDetails {
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
}

interface ClientProposalViewProps {
  token: string;
  title: string;
  comment: string | null;
  status: string;
  approvedOptionId: string | null;
  options: ProposalOption[];
  companyName: string;
  companyAddress: string | null;
  companyPhone: string | null;
  companyEmail: string | null;
  logoUrl: string | null;
  deliveryDate?: string | null;
  images?: string[];
  requestDetails?: RequestDetails;
}

function dimStr(r: RequestDetails): string | null {
  const parts = [r.width, r.height, r.depth].filter((v) => v != null);
  if (!parts.length) return null;
  return `${parts.join(" × ")} ${r.size_unit || "mm"}`;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: "3px 0", fontSize: 13, color: "#94a3b8", width: 100, verticalAlign: "middle", fontWeight: 600, whiteSpace: "nowrap" }}>{label}</td>
      <td style={{ padding: "3px 0 3px 10px", fontSize: 14, color: "#334155", whiteSpace: "nowrap" }}>{value}</td>
    </tr>
  );
}

export function ClientProposalView({
  token, title, comment, status: initialStatus, approvedOptionId: initialApproved,
  options, companyName, companyAddress, companyPhone, companyEmail, logoUrl, deliveryDate, images, requestDetails,
}: ClientProposalViewProps) {
  const [status, setStatus] = useState(initialStatus);
  const [approvedId, setApprovedId] = useState<string | null>(initialApproved);
  const [selectedId, setSelectedId] = useState<string | null>(initialApproved ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDone = status === "approved" || status === "rejected";
  const approvedOption = approvedId ? options.find((o) => o.id === approvedId) : null;
  const dim = requestDetails ? dimStr(requestDetails) : null;
  const primaryOption = options[0] ?? null;
  const extraOptions = options.slice(1);

  function OptionCard({ opt }: { opt: ProposalOption }) {
    const sel = selectedId === opt.id;
    const qty = requestDetails?.quantity;
    const ttl = qty != null && qty > 0 ? opt.final_price * qty : null;
    const fmt = (n: number, decimals = true) =>
      decimals
        ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : n.toLocaleString("en-US", { maximumFractionDigits: 0 });
    const sym = opt.currency === "USD" ? "$" : opt.currency === "EUR" ? "€" : opt.currency === "GBP" ? "£" : opt.currency === "CAD" ? "C$" : `${opt.currency} `;
    const priceLabel = ttl != null
      ? `Unit Price ${sym}${fmt(opt.final_price)} | For ${(qty ?? 0).toLocaleString()} units ${sym}${fmt(ttl, false)}`
      : `Unit Price ${sym}${fmt(opt.final_price)}`;
    return (
      <div>
        <button type="button" onClick={() => setSelectedId(opt.id)}
          style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, width: "100%", padding: "14px 18px", borderRadius: opt.note ? "12px 12px 0 0" : 12, cursor: "pointer", border: `2px solid ${sel ? "#6366f1" : "#e2e8f0"}`, background: sel ? "#f0f0ff" : "#fafafa", textAlign: "left", fontFamily: "inherit", transition: "all .15s" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${sel ? "#6366f1" : "#cbd5e1"}`, background: sel ? "#6366f1" : "#fff", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", transition: "all .15s" }}>
              {sel && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" strokeWidth="1.5" stroke="white"/></svg>}
            </div>
            <span style={{ fontWeight: 600, fontSize: 15, color: "#1e293b", flex: 1, minWidth: 0 }}>{opt.label}</span>
            {deliveryDate && (
              <span style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {deliveryDate}
              </span>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: sel ? "#6366f1" : "#334155", paddingLeft: 32, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {priceLabel}
          </div>
        </button>
        {opt.note && (
          <div style={{ padding: "9px 20px 12px", background: sel ? "#f0f0ff" : "#f8fafc", border: `2px solid ${sel ? "#6366f1" : "#e2e8f0"}`, borderTop: "none", borderRadius: "0 0 12px 12px", fontSize: 13, color: "#64748b", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
            {opt.note}
          </div>
        )}
      </div>
    );
  }

  async function respond(action: "approve" | "reject") {
    if (action === "approve" && !selectedId) {
      setError("Please select an option before approving.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/proposal/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, option_id: action === "approve" ? selectedId : null }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus(data.status);
        if (action === "approve") setApprovedId(selectedId);
      } else {
        setError(data.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#f0f4f8",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "40px 16px 80px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      <div style={{ background: "#fff", borderRadius: 20, width: "100%", maxWidth: 620, boxShadow: "0 8px 40px rgba(0,0,0,.10)", overflow: "hidden" }}>

        {/* ── Company header ── */}
        <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", padding: "22px 28px", color: "#fff" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            {logoUrl && (
              <div style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
                <Image src={logoUrl} alt={companyName} width={40} height={40} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            )}
            <div style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {companyName || "Price Proposal"}
              {(companyPhone || companyEmail) && (
                <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.55 }}>
                  {" · "}{[companyPhone, companyEmail].filter(Boolean).join(" · ")}
                </span>
              )}
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 22, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {title}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "28px 34px 34px" }}>

          {comment && (
            <div style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: "#475569", lineHeight: 1.65, borderLeft: "3px solid #e2e8f0" }}>
              {comment}
            </div>
          )}

          {/* Approved/rejected banner */}
          {status === "approved" && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "20px 24px", marginBottom: 24, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 6 }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#15803d" }}>Proposal Approved!</div>
              {approvedOption && (
                <div style={{ marginTop: 8, fontSize: 14, color: "#166534" }}>
                  You selected: <strong>{approvedOption.label}</strong> —{" "}
                  <strong>{approvedOption.currency} {approvedOption.final_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 13, color: "#16a34a" }}>Thank you! We will be in touch shortly.</div>
            </div>
          )}

          {status === "rejected" && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "20px 24px", marginBottom: 24, textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#dc2626" }}>Proposal Declined</div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#ef4444" }}>We received your response. Feel free to contact us if you'd like to discuss further.</div>
            </div>
          )}

          {/* Primary option — always above product details */}
          {primaryOption && !isDone && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 12 }}>
                Your quote
              </div>
              <OptionCard opt={primaryOption} />
            </div>
          )}

          {/* Product details */}
          {requestDetails && (
            <div style={{ marginBottom: 24, borderBottom: "1px solid #f1f5f9", paddingBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 12 }}>
                Product Details
              </div>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", justifyContent: "space-between" }}>
                <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                  <table style={{ borderCollapse: "collapse", width: "auto" }}>
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
                {(images ?? []).length > 0 && (
                  <div style={{
                    flex: "0 0 auto",
                    display: "grid",
                    gridTemplateColumns: "repeat(2, 88px)",
                    gridTemplateRows: "repeat(2, 88px)",
                    gap: 6,
                  }}>
                    {(images ?? []).slice(0, 4).map((url, i) => (
                      <div key={i} style={{ width: 88, height: 88, borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Product ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Images only (no request details) */}
          {!requestDetails && (images ?? []).length > 0 && (
            <div style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 88px)",
                gridTemplateRows: "repeat(2, 88px)",
                gap: 6,
              }}>
                {(images ?? []).slice(0, 4).map((url, i) => (
                  <div key={i} style={{ width: 88, height: 88, borderRadius: 10, overflow: "hidden", border: "1px solid #e2e8f0", background: "#f8fafc" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Product ${i + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Extra options — below product details */}
          {extraOptions.length > 0 && !isDone && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 12 }}>
                More options
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {extraOptions.map((opt) => (
                  <OptionCard key={opt.id} opt={opt} />
                ))}
              </div>
            </div>
          )}

          {/* Read-only approved option */}
          {isDone && approvedOption && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 10 }}>Selected option</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderRadius: 12, border: "2px solid #86efac", background: "#f0fdf4" }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{approvedOption.label}</span>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#15803d" }}>
                  {approvedOption.currency} {approvedOption.final_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 14, color: "#dc2626" }}>
              {error}
            </div>
          )}

          {/* Action buttons */}
          {!isDone && (
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              <button type="button" onClick={() => respond("approve")} disabled={loading || !selectedId}
                style={{ flex: 1, padding: "14px 0", borderRadius: 12, cursor: loading || !selectedId ? "not-allowed" : "pointer", background: selectedId ? "#6366f1" : "#e2e8f0", color: selectedId ? "#fff" : "#94a3b8", border: "none", fontWeight: 800, fontSize: 16, fontFamily: "inherit", transition: "all .15s" }}>
                {loading ? "Processing…" : "Approve"}
              </button>
              <button type="button" onClick={() => respond("reject")} disabled={loading}
                style={{ padding: "14px 24px", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer", background: "#fff", color: "#94a3b8", border: "1.5px solid #e2e8f0", fontWeight: 600, fontSize: 15, fontFamily: "inherit" }}>
                Decline
              </button>
            </div>
          )}

          <button type="button" onClick={() => window.print()}
            style={{ marginTop: 20, display: "block", width: "100%", padding: "11px 0", borderRadius: 10, cursor: "pointer", background: "none", border: "1.5px dashed #cbd5e1", color: "#94a3b8", fontWeight: 600, fontSize: 13, fontFamily: "inherit" }}>
            ↓ Download / Print as PDF
          </button>
        </div>
      </div>

      <div style={{ marginTop: 28, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
        Prepared by {companyName || "your print house"}
      </div>

      <style>{`@media print { body { background: white !important; } button { display: none !important; } }`}</style>
    </div>
  );
}
