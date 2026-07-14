"use client";

import { useRef, useState } from "react";
import type { CompanySettings } from "@/lib/types";

type Props = {
  settings: CompanySettings;
  logoUrl: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (formData: FormData) => Promise<any>;
};

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      style={{ display: "inline", marginRight: 5, verticalAlign: "middle", color: "var(--muted)" }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

const card = { padding: "16px 18px", marginBottom: 14 } as const;
const fld  = { marginBottom: 10 } as const;

export function SettingsForm({ settings: s, logoUrl: initialLogoUrl, action }: Props) {
  const [isDirty, setIsDirty] = useState(false);
  const [managerName, setManagerName] = useState(s.manager_name ?? "");
  const [managerPhone, setManagerPhone] = useState(s.manager_phone ?? "");
  const [managerEmail, setManagerEmail] = useState(s.manager_email ?? "");
  const [contactName, setContactName] = useState(s.contact_name ?? "");
  const [contactPhone, setContactPhone] = useState(s.contact_phone ?? "");
  const [contactEmail, setContactEmail] = useState(s.contact_email ?? "");
  const [logoPreview, setLogoPreview] = useState<string | null>(initialLogoUrl);
  const [logoHover, setLogoHover] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  function markDirty() { setIsDirty(true); }

  function copyManagerInfo() {
    setContactName(managerName);
    setContactPhone(managerPhone);
    setContactEmail(managerEmail);
    setIsDirty(true);
  }

  return (
    <form action={action} onChange={markDirty} onSubmit={() => setIsDirty(false)}>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>

        {/* ── Column 1: Company ── */}
        <div>
          <div className="card" style={card}>
            <p className="card-section-title" style={{ marginBottom: 14 }}>Company</p>

            {/* Logo upload */}
            <input
              ref={logoInputRef}
              name="company_logo"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              style={{ display: "none" }}
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setLogoPreview((prev) => {
                  if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
                  return file ? URL.createObjectURL(file) : null;
                });
                markDirty();
              }}
            />
            <input type="hidden" name="current_logo_path" value={s.logo_path ?? ""} />

            <div
              onClick={() => logoInputRef.current?.click()}
              onMouseEnter={() => setLogoHover(true)}
              onMouseLeave={() => setLogoHover(false)}
              title="Click to upload logo"
              style={{
                width: "100%", height: 110, borderRadius: 10, marginBottom: 14,
                border: `2px dashed ${logoHover ? "var(--indigo)" : "var(--border)"}`,
                background: logoHover ? "var(--indigo-50)" : "#fafafa",
                cursor: "pointer", overflow: "hidden", position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center",
                transition: "border-color .15s, background .15s",
              }}
            >
              {logoPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview}
                    alt="Company logo"
                    style={{ maxWidth: "80%", maxHeight: "80%", objectFit: "contain" }}
                  />
                  {logoHover && (
                    <div style={{
                      position: "absolute", inset: 0, background: "rgba(0,0,0,0.4)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign: "center", color: "var(--muted)", pointerEvents: "none" }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ display: "block", margin: "0 auto 6px" }}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <span style={{ fontSize: 12 }}>Click to upload logo</span>
                  <div style={{ fontSize: 11, marginTop: 2, opacity: 0.7 }}>PNG, JPG, SVG, WebP · max 2 MB</div>
                </div>
              )}
            </div>

            <div className="field" style={fld}>
              <label>Company name *</label>
              <input name="company_name" required placeholder="Acme Print House" defaultValue={s.company_name ?? ""} />
            </div>
            <div className="field" style={fld}>
              <label>HQ address</label>
              <input name="hq_address" placeholder="123 Main St, Chicago, IL 60601" defaultValue={s.hq_address ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Branches <span className="small muted">(one per line)</span></label>
              <textarea
                name="branches"
                placeholder={"456 West Ave, New York, NY\n789 Oak Blvd, Los Angeles, CA"}
                defaultValue={s.branches ?? ""}
                style={{ minHeight: 64, fontFamily: "inherit", fontSize: 14 }}
              />
            </div>
          </div>

          {/* Registration numbers */}
          <div className="card" style={{ ...card, marginBottom: 0 }}>
            <p className="card-section-title" style={{ marginBottom: 12 }}>Registration numbers</p>
            <div className="grid cols-2" style={{ gap: 10 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>CI number</label>
                <input name="ci_number" placeholder="CI-123456" defaultValue={s.ci_number ?? ""} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>EIN / Tax number</label>
                <input name="ein" placeholder="XX-XXXXXXX" defaultValue={s.ein ?? ""} pattern="\d{2}-\d{7}" title="Format: XX-XXXXXXX" />
              </div>
            </div>
          </div>
        </div>

        {/* ── Column 2: Distribution Manager + Contact ── */}
        <div>
          {/* Distribution manager */}
          <div className="card" style={card}>
            <p className="card-section-title" style={{ marginBottom: 4 }}>Distribution manager</p>
            <p className="small muted" style={{ margin: "0 0 12px" }}>
              The person who manages vendor relationships and dispatches requests.
            </p>
            <div className="field" style={fld}>
              <label>Full name</label>
              <input
                name="manager_name"
                placeholder="Jordan Smith"
                value={managerName}
                onChange={(e) => { setManagerName(e.target.value); markDirty(); }}
                pattern="[A-Za-zÀ-ÿ'\s\-]+"
                title="Name should contain letters only"
              />
            </div>
            <div className="field" style={fld}>
              <label>Phone</label>
              <input
                name="manager_phone"
                type="tel"
                placeholder="+1 312 555 0100"
                value={managerPhone}
                onChange={(e) => { setManagerPhone(e.target.value); markDirty(); }}
                pattern="[+\d][\d\s\-().]{6,19}"
                title="Enter a valid phone number"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Email</label>
              <input
                name="manager_email"
                type="email"
                placeholder="manager@company.com"
                value={managerEmail}
                onChange={(e) => { setManagerEmail(e.target.value); markDirty(); }}
              />
            </div>
          </div>

          {/* Contact shown to vendors */}
          <div className="card" style={{ ...card, marginBottom: 0 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 4 }}>
              <p className="card-section-title" style={{ marginBottom: 0 }}>Contact shown to vendors</p>
              <button
                type="button"
                onClick={copyManagerInfo}
                title="Copy name, phone and email from Distribution manager"
                style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 12, fontWeight: 500, color: "var(--indigo)",
                  background: "var(--indigo-50)", border: "1px solid var(--indigo-100)",
                  borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                  transition: "background .15s", whiteSpace: "nowrap", flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--indigo-100)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "var(--indigo-50)")}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M17 1l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                  <path d="M7 23l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                </svg>
                Copy manager info
              </button>
            </div>
            <p className="small muted" style={{ margin: "0 0 12px" }}>
              This is what your suppliers and partners see when they need to reach you.
            </p>
            <div className="field" style={fld}>
              <label>Contact name *</label>
              <input
                name="contact_name"
                required
                placeholder="Jordan Smith"
                value={contactName}
                onChange={(e) => { setContactName(e.target.value); markDirty(); }}
                pattern="[A-Za-zÀ-ÿ'\s\-]+"
                title="Name should contain letters only"
              />
            </div>
            <div className="field" style={fld}>
              <label>Phone *</label>
              <input
                name="contact_phone"
                type="tel"
                required
                placeholder="+1 312 555 0200"
                value={contactPhone}
                onChange={(e) => { setContactPhone(e.target.value); markDirty(); }}
                pattern="[+\d][\d\s\-().]{6,19}"
                title="Enter a valid phone number"
              />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Email *</label>
              <input
                name="contact_email"
                type="email"
                required
                placeholder="contact@company.com"
                value={contactEmail}
                onChange={(e) => { setContactEmail(e.target.value); markDirty(); }}
              />
            </div>
          </div>
        </div>

        {/* ── Column 3: Financial / Banking ── */}
        <div>
          <div className="card" style={{ ...card, marginBottom: 0 }}>
            <p className="card-section-title" style={{ marginBottom: 4 }}>
              <LockIcon />Financial / Banking
            </p>
            <p className="small muted" style={{ margin: "0 0 14px" }}>
              Reference only — encrypted at rest in production.
            </p>
            <div className="field" style={fld}>
              <label>Bank name</label>
              <input name="bank_name" placeholder="First National Bank" defaultValue={s.bank_name ?? ""} />
            </div>
            <div className="field" style={fld}>
              <label>Bank account / IBAN</label>
              <input name="bank_account" placeholder="US00 0000 0000 0000" defaultValue={s.bank_account ?? ""} />
            </div>
            <div className="field" style={fld}>
              <label>SWIFT / BIC</label>
              <input name="swift" placeholder="CHASUS33" defaultValue={s.swift ?? ""} />
            </div>
            <div className="field" style={{ marginBottom: 0 }}>
              <label>Payment terms</label>
              <select name="payment_terms" defaultValue={s.payment_terms ?? ""}>
                <option value="">— Not set —</option>
                <option value="Prepaid">Prepaid</option>
                <option value="Due on receipt">Due on receipt</option>
                <option value="Net 15">Net 15</option>
                <option value="Net 30">Net 30</option>
                <option value="Net 45">Net 45</option>
                <option value="Net 60">Net 60</option>
              </select>
            </div>
          </div>
        </div>

      </div>

      {isDirty && (
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
          background: "#fff", borderTop: "1px solid var(--border)",
          padding: "10px 32px", display: "flex", alignItems: "center",
          justifyContent: "space-between", boxShadow: "0 -2px 16px rgba(16,24,40,0.09)",
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: "var(--amber-text)", fontWeight: 500 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Unsaved changes
          </span>
          <button type="submit" className="btn" style={{ padding: "8px 22px" }}>Save settings</button>
        </div>
      )}
    </form>
  );
}
