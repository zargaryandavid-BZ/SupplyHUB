"use client";

import { useState } from "react";
import type { CompanySettings } from "@/lib/types";

type Props = {
  settings: CompanySettings;
  logoUrl: string | null;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy"
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: copied ? "var(--green, #16a34a)" : "var(--muted)",
        padding: "2px 4px", borderRadius: 4, lineHeight: 1,
        display: "inline-flex", alignItems: "center",
        transition: "color .15s",
      }}
    >
      {copied ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  );
}

export function PrintHouseContactCard({ settings: s, logoUrl }: Props) {
  const [showFinancial, setShowFinancial] = useState(false);

  const branches = (s.branches ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const hasFinancial = Boolean(s.bank_name || s.bank_account || s.swift || s.payment_terms);
  const hasContact = Boolean(s.contact_name || s.contact_phone || s.contact_email);

  return (
    <div className="card" style={{ marginBottom: 18, padding: "14px 18px" }}>
      {/* ── Top row: logo | company | contact | financial button ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>

        {/* Logo */}
        <div style={{
          width: 80, height: 80, borderRadius: 12, flexShrink: 0,
          border: "1px solid var(--border)", background: "#f8f8f8",
          display: "flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
        }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={s.company_name ?? "Logo"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          ) : (
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-4 0v2" /><path d="M8 7V5a2 2 0 0 1 4 0v2" />
            </svg>
          )}
        </div>

        {/* Company name + address */}
        <div style={{ flex: "0 0 auto", minWidth: 160 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{s.company_name || "Print house"}</div>
          {s.hq_address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.hq_address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="small muted"
              style={{ textDecoration: "underline", textDecorationStyle: "dotted" }}
            >
              {s.hq_address}
            </a>
          )}
          {branches.map((b) => (
            <a
              key={b}
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="small muted"
              style={{ display: "block", textDecoration: "underline", textDecorationStyle: "dotted" }}
            >
              {b}
            </a>
          ))}
        </div>

        {/* Divider */}
        {hasContact && (
          <div style={{ width: 1, alignSelf: "stretch", background: "var(--border)", flexShrink: 0 }} />
        )}

        {/* Contact info */}
        {hasContact && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="card-section-title" style={{ marginBottom: 6 }}>Contact</p>
            <dl className="dl" style={{ gridTemplateColumns: "60px 1fr", rowGap: 3 }}>
              {s.contact_name && <><dt>Name</dt><dd style={{ fontWeight: 500 }}>{s.contact_name}</dd></>}
              {s.contact_phone && (
                <><dt>Phone</dt><dd><a href={`tel:${s.contact_phone}`}>{s.contact_phone}</a></dd></>
              )}
              {s.contact_email && (
                <><dt>Email</dt><dd><a href={`mailto:${s.contact_email}`}>{s.contact_email}</a></dd></>
              )}
            </dl>
          </div>
        )}

        {/* Financial toggle button — always visible */}
        <button
          type="button"
          onClick={() => setShowFinancial((v) => !v)}
          title={showFinancial ? "Hide financial info" : "Show financial info"}
          style={{
            display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
            fontSize: 12, fontWeight: 500,
            color: showFinancial ? "var(--indigo)" : "var(--muted)",
            background: showFinancial ? "var(--indigo-50)" : "#f5f5f5",
            border: `1px solid ${showFinancial ? "var(--indigo-100)" : "var(--border)"}`,
            borderRadius: 7, padding: "6px 12px", cursor: "pointer",
            transition: "all .15s",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Financial
        </button>
      </div>

      {/* Financial panel */}
      {showFinancial && (
        <div style={{
          marginTop: 12,
          background: "var(--indigo-50, #eef2ff)",
          border: "1px solid var(--indigo-100, #c7d2fe)",
          borderRadius: 8, padding: "12px 14px",
        }}>
          <p className="card-section-title" style={{ marginBottom: 10, color: "var(--indigo)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", marginRight: 5, verticalAlign: "middle" }}>
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Financial information
          </p>
          {!hasFinancial && (
            <p className="small muted" style={{ margin: 0 }}>No financial information has been set yet.</p>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: "8px 24px" }}>
            {s.bank_name && (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Bank name</div>
                <div style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                  {s.bank_name} <CopyButton text={s.bank_name} />
                </div>
              </div>
            )}
            {s.bank_account && (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Bank account / IBAN</div>
                <div style={{ fontSize: 13, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.bank_account} <CopyButton text={s.bank_account} />
                </div>
              </div>
            )}
            {s.swift && (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>SWIFT / BIC</div>
                <div style={{ fontSize: 13, fontFamily: "monospace", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.swift} <CopyButton text={s.swift} />
                </div>
              </div>
            )}
            {s.payment_terms && (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 2 }}>Payment terms</div>
                <div style={{ fontSize: 13 }}>{s.payment_terms}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
