"use client";

import { useState } from "react";
import Image from "next/image";

interface ProposalOption {
  id: string;
  label: string;
  currency: string;
  final_price: number;
}

interface ClientProposalViewProps {
  token: string;
  title: string;
  comment: string | null;
  clientName: string;
  status: string;
  approvedOptionId: string | null;
  options: ProposalOption[];
  companyName: string;
  companyAddress: string | null;
  logoUrl: string | null;
}

export function ClientProposalView({
  token,
  title,
  comment,
  clientName,
  status: initialStatus,
  approvedOptionId: initialApproved,
  options,
  companyName,
  companyAddress,
  logoUrl,
}: ClientProposalViewProps) {
  const [status, setStatus] = useState(initialStatus);
  const [approvedId, setApprovedId] = useState<string | null>(initialApproved);
  const [selectedId, setSelectedId] = useState<string | null>(initialApproved ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isDone = status === "approved" || status === "rejected";

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

  const approvedOption = approvedId ? options.find((o) => o.id === approvedId) : null;

  return (
    <div style={{
      minHeight: "100vh", background: "#f8fafc",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "40px 16px 80px",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    }}>
      {/* Card */}
      <div style={{
        background: "#fff", borderRadius: 20, width: "100%", maxWidth: 600,
        boxShadow: "0 8px 40px rgba(0,0,0,.10)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
          padding: "32px 36px", color: "#fff",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
            {logoUrl && (
              <div style={{ width: 56, height: 56, borderRadius: 12, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
                <Image src={logoUrl} alt={companyName} width={56} height={56} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, letterSpacing: "-0.3px" }}>{companyName || "Price Proposal"}</div>
              {companyAddress && <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{companyAddress}</div>}
            </div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 6 }}>
            Price Proposal for
          </div>
          <div style={{ fontWeight: 800, fontSize: 22 }}>{title}</div>
          <div style={{ marginTop: 8, fontSize: 14, opacity: 0.8 }}>Hi, {clientName}</div>
        </div>

        {/* Body */}
        <div style={{ padding: "32px 36px" }}>
          {comment && (
            <div style={{ background: "#f1f5f9", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 14, color: "#475569", lineHeight: 1.6 }}>
              {comment}
            </div>
          )}

          {/* Already responded */}
          {status === "approved" && (
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: "20px 24px", marginBottom: 24, textAlign: "center" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>✓</div>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#15803d" }}>Proposal Approved!</div>
              {approvedOption && (
                <div style={{ marginTop: 8, fontSize: 14, color: "#166534" }}>
                  You selected: <strong>{approvedOption.label}</strong> —{" "}
                  <strong>{approvedOption.currency} {approvedOption.final_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong>
                </div>
              )}
              <div style={{ marginTop: 12, fontSize: 13, color: "#16a34a" }}>Thank you! We will be in touch shortly.</div>
            </div>
          )}

          {status === "rejected" && (
            <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 12, padding: "20px 24px", marginBottom: 24, textAlign: "center" }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: "#dc2626" }}>Proposal Declined</div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#ef4444" }}>We received your response. Feel free to contact us if you'd like to discuss further.</div>
            </div>
          )}

          {/* Options */}
          {options.length > 0 && !isDone && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 14 }}>
                {options.length === 1 ? "Your quote" : "Choose an option"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {options.map((opt) => {
                  const selected = selectedId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => !isDone && setSelectedId(opt.id)}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "16px 20px", borderRadius: 12, cursor: isDone ? "default" : "pointer",
                        border: `2px solid ${selected ? "#6366f1" : "#e2e8f0"}`,
                        background: selected ? "#f0f0ff" : "#fafafa",
                        textAlign: "left", fontFamily: "inherit", transition: "all .15s",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: "50%",
                          border: `2px solid ${selected ? "#6366f1" : "#cbd5e1"}`,
                          background: selected ? "#6366f1" : "#fff",
                          flexShrink: 0, transition: "all .15s",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {selected && <svg width="10" height="10" viewBox="0 0 10 10" fill="white"><path d="M2 5l2 2 4-4"/></svg>}
                        </div>
                        <span style={{ fontWeight: 600, fontSize: 15, color: "#1e293b" }}>{opt.label}</span>
                      </div>
                      <span style={{ fontWeight: 800, fontSize: 16, color: selected ? "#6366f1" : "#334155", flexShrink: 0, marginLeft: 12 }}>
                        {opt.currency} {opt.final_price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Show options in read-only if done */}
          {options.length > 0 && isDone && approvedOption && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#94a3b8", marginBottom: 10 }}>
                Selected option
              </div>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "16px 20px", borderRadius: 12,
                border: "2px solid #86efac", background: "#f0fdf4",
              }}>
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
              <button
                type="button"
                onClick={() => respond("approve")}
                disabled={loading || !selectedId}
                style={{
                  flex: 1, padding: "14px 0", borderRadius: 12, cursor: loading || !selectedId ? "not-allowed" : "pointer",
                  background: selectedId ? "#6366f1" : "#e2e8f0",
                  color: selectedId ? "#fff" : "#94a3b8",
                  border: "none", fontWeight: 800, fontSize: 16, fontFamily: "inherit",
                  transition: "all .15s",
                }}
              >
                {loading ? "Processing…" : "Approve"}
              </button>
              <button
                type="button"
                onClick={() => respond("reject")}
                disabled={loading}
                style={{
                  padding: "14px 24px", borderRadius: 12, cursor: loading ? "not-allowed" : "pointer",
                  background: "#fff", color: "#94a3b8",
                  border: "1.5px solid #e2e8f0", fontWeight: 600, fontSize: 15, fontFamily: "inherit",
                }}
              >
                Decline
              </button>
            </div>
          )}

          {/* PDF download */}
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              marginTop: 20, display: "block", width: "100%",
              padding: "11px 0", borderRadius: 10, cursor: "pointer",
              background: "none", border: "1.5px dashed #cbd5e1",
              color: "#94a3b8", fontWeight: 600, fontSize: 13, fontFamily: "inherit",
            }}
          >
            ↓ Download / Print as PDF
          </button>
        </div>
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
        This proposal was prepared by {companyName || "your print house"}.
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; }
          button { display: none !important; }
        }
      `}</style>
    </div>
  );
}
