"use client";

import { useEffect, useRef, useState } from "react";
import type { Partner } from "@/lib/types";
import { PartnerProducts } from "@/components/PartnerProducts";

const CHANNELS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Phone call" },
];

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (formData: FormData) => Promise<any>;
  partner?: Partner;
  logoUrl?: string | null;
  productImageUrls?: (string | null)[][];
  knownProducts?: string[];
  /** When true (after redirect ?saved=1), scroll to top so the success notice is visible. */
  justSaved?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  generatePortalToken?: (formData: FormData) => Promise<any>;
};

const card = { padding: "13px 15px", marginBottom: 14 } as const;
const fld = { marginBottom: 10 } as const;

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ display: "inline", marginRight: 5, verticalAlign: "middle", color: "var(--muted)" }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/** Wrapper that adds a show/hide toggle to a password-style input */
function SecretField({
  name,
  label,
  placeholder,
  defaultValue,
  style,
}: {
  name: string;
  label: string;
  placeholder?: string;
  defaultValue?: string;
  style?: React.CSSProperties;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="field" style={style}>
      <label>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          name={name}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          defaultValue={defaultValue ?? ""}
          autoComplete="off"
          style={{ paddingRight: 38 }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          title={show ? "Hide" : "Show"}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            padding: 0,
            display: "flex",
            alignItems: "center",
          }}
        >
          <EyeIcon open={show} />
        </button>
      </div>
    </div>
  );
}

export function PartnerForm({
  action,
  partner,
  logoUrl,
  productImageUrls,
  knownProducts = [],
  justSaved = false,
  generatePortalToken,
}: Props) {
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const contactFirstRef = useRef<HTMLInputElement>(null);
  const contactLastRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const portalFirstRef = useRef<HTMLInputElement>(null);
  const portalLastRef = useRef<HTMLInputElement>(null);
  const portalEmailRef = useRef<HTMLInputElement>(null);

  const selectedChannels = partner?.preferred_channels
    ? partner.preferred_channels.split(",").map((c) => c.trim())
    : [];

  const showSaveUi = isDirty || saving;

  // After a successful save redirect, jump to the top so the success notice is visible.
  useEffect(() => {
    if (!justSaved) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [justSaved]);

  // Warn before leaving with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  function beginSave() {
    setSaving(true);
    setIsDirty(false);
  }

  return (
    <>
      <form
        ref={formRef}
        action={action}
        onChange={() => {
          if (!saving) setIsDirty(true);
        }}
        onSubmit={() => beginSave()}
      >
        {partner ? <input type="hidden" name="id" value={partner.id} /> : null}
        <div className="grid cols-2" style={{ alignItems: "start", gap: 16 }}>
          {/* ── Left column ── */}
          <div>
            {/* Basics */}
            <div className="card" style={card}>
              <p className="card-section-title" style={{ marginBottom: 12 }}>Basics</p>
              <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>

                {/* Clickable logo upload */}
                <div style={{ flex: "none" }}>
                  <input
                    ref={logoInputRef}
                    name="logo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setLogoPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return file ? URL.createObjectURL(file) : null;
                      });
                    }}
                  />
                  <div
                    title={logoPreview || logoUrl ? "Click to change logo" : "Click to upload logo"}
                    onClick={() => logoInputRef.current?.click()}
                    className="logo-upload-box"
                    style={{
                      width: 100,
                      height: 100,
                      borderRadius: 12,
                      border: logoPreview || logoUrl ? "1px solid var(--border)" : "1.5px dashed #d1d5db",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#f8fafc",
                      cursor: "pointer",
                      position: "relative",
                    }}
                  >
                    {logoPreview || logoUrl ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={logoPreview ?? logoUrl!}
                          alt={partner?.company}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                        {/* Hover overlay — shown via CSS in globals */}
                        <div
                          className="logo-upload-overlay"
                          style={{
                            position: "absolute", inset: 0,
                            background: "rgba(37,99,235,0.55)",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            gap: 4, color: "#fff",
                            opacity: 0,
                            transition: "opacity .15s",
                          }}
                        >
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span style={{ fontSize: 11, fontWeight: 600 }}>Change</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: "#9ca3af", marginBottom: 6 }}>
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        <span style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", lineHeight: 1.3 }}>Upload logo</span>
                      </>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.4, width: 100 }}>
                    PNG, JPG, WebP, SVG · max 2 MB
                  </p>
                </div>

                {/* Company info — 3-col top row, EIN + website below */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 10, marginBottom: 10 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Company name *</label>
                      <input name="company" required placeholder="PrintPro Bindery" defaultValue={partner?.company ?? ""} pattern=".*[A-Za-z].*" title="Company name must contain at least one letter" />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Location</label>
                      <input name="location" placeholder="Chicago, US" defaultValue={partner?.location ?? ""} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>EIN number</label>
                      <input name="ein" placeholder="XX-XXXXXXX" defaultValue={partner?.ein ?? ""} pattern="\d{2}-\d{7}" title="Format: XX-XXXXXXX (e.g. 12-3456789)" />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <label>Website</label>
                      <input name="website" type="url" placeholder="https://printpro.example.com" defaultValue={partner?.website ?? ""} />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact & channels — email/phone on top row, channels below */}
            <div className="card" style={{ ...card, marginBottom: 0 }}>
              <p className="card-section-title" style={{ marginBottom: 10 }}>Contact &amp; preferred channels</p>

              {/* First name + Last name */}
              {(() => {
                const parts = (partner?.contact ?? "").trim().split(/\s+/);
                const firstName = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "";
                const lastName  = parts.length > 1 ? parts[parts.length - 1] : "";
                return (
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>First name</label>
                      <input ref={contactFirstRef} name="contact_first" placeholder="Alex" defaultValue={firstName} pattern="[A-Za-zÀ-ÿ'\s\-]+" title="First name should contain letters only" />
                    </div>
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>Last name</label>
                      <input ref={contactLastRef} name="contact_last" placeholder="Novak" defaultValue={lastName} pattern="[A-Za-zÀ-ÿ'\s\-]+" title="Last name should contain letters only" />
                    </div>
                  </div>
                );
              })()}

              {/* Email + Phone */}
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>Email</label>
                  <input ref={emailRef} name="email" type="email" placeholder="alex@printpro.com" defaultValue={partner?.email ?? ""} />
                </div>
                <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                  <label>Phone</label>
                  <input name="phone" type="tel" placeholder="+1 312 555 0201" defaultValue={partner?.phone ?? ""} pattern="[+\d][\d\s\-().]{6,19}" title="Enter a valid phone number (e.g. +1 312 555 0201)" />
                </div>
              </div>

              {/* Preferred channels */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Preferred channels</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {CHANNELS.map((ch) => (
                    <label key={ch.value} className="check" style={{ padding: "8px 12px" }}>
                      <input
                        type="checkbox"
                        name="preferred_channels"
                        value={ch.value}
                        defaultChecked={selectedChannels.includes(ch.value)}
                      />
                      {ch.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Right column ── */}
          <div>
            {/* Portal access */}
            <div className="card" style={card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <p className="card-section-title" style={{ marginBottom: 0 }}>Portal access</p>
                <button
                  type="button"
                  title="Copy first name, last name & email from Contact section"
                  onClick={() => {
                    const first = contactFirstRef.current?.value ?? "";
                    const last = contactLastRef.current?.value ?? "";
                    const email = emailRef.current?.value ?? "";
                    if (portalFirstRef.current) portalFirstRef.current.value = first;
                    if (portalLastRef.current) portalLastRef.current.value = last;
                    if (portalEmailRef.current) portalEmailRef.current.value = email;
                    setIsDirty(true);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 12, fontWeight: 500, color: "var(--indigo)",
                    background: "var(--indigo-50)", border: "1px solid var(--indigo-100)",
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                    transition: "background .15s",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--indigo-100)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--indigo-50)")}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M17 1l4 4-4 4" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <path d="M7 23l-4-4 4-4" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                  Copy from contact
                </button>
              </div>
              <p className="small muted" style={{ margin: "0 0 10px" }}>
                The person who logs into the supplier portal to respond to quote requests.
              </p>
              {(() => {
                const parts = (partner?.portal_contact_name ?? "").trim().split(/\s+/);
                const portalFirst = parts.length > 1 ? parts.slice(0, -1).join(" ") : parts[0] ?? "";
                const portalLast = parts.length > 1 ? parts[parts.length - 1] : "";
                return (
                  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>First name</label>
                      <input ref={portalFirstRef} name="portal_contact_first" placeholder="Alex" defaultValue={portalFirst} pattern="[A-Za-zÀ-ÿ'\s\-]+" title="First name should contain letters only" />
                    </div>
                    <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                      <label>Last name</label>
                      <input ref={portalLastRef} name="portal_contact_last" placeholder="Novak" defaultValue={portalLast} pattern="[A-Za-zÀ-ÿ'\s\-]+" title="Last name should contain letters only" />
                    </div>
                  </div>
                );
              })()}
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Portal email</label>
                <input ref={portalEmailRef} name="portal_email" type="email" placeholder="alex@printpro.com" defaultValue={partner?.portal_email ?? ""} />
              </div>

              {/* Portal access link */}
              {partner && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>Portal access link</span>
                    {generatePortalToken && (
                      <form action={generatePortalToken}>
                        <input type="hidden" name="id" value={partner.id} />
                        <button
                          type="submit"
                          style={{
                            fontSize: 12, color: "var(--indigo)", background: "none",
                            border: "none", cursor: "pointer", padding: 0, fontWeight: 500,
                          }}
                        >
                          {partner.portal_token ? "Regenerate" : "Generate link"}
                        </button>
                      </form>
                    )}
                  </div>

                  {partner.portal_token ? (() => {
                    const portalUrl = typeof window !== "undefined"
                      ? `${window.location.origin}/api/portal?token=${partner.portal_token}`
                      : `/api/portal?token=${partner.portal_token}`;
                    const recipientEmail = partner.portal_email || partner.email || "";
                    const mailtoBody = `Hi ${partner.portal_contact_name || partner.contact || "there"},\n\nHere is your unique link to access the SupplyerHUB supplier portal:\n\n${portalUrl}\n\nThis link logs you in directly — no password needed.\n\nBest regards`;
                    const mailto = `mailto:${recipientEmail}?subject=${encodeURIComponent("Your SupplyerHUB portal access link")}&body=${encodeURIComponent(mailtoBody)}`;
                    return (
                      <div>
                        <div style={{
                          display: "flex", alignItems: "center", gap: 6,
                          background: "#f8fafc", border: "1px solid var(--border)",
                          borderRadius: "var(--radius-sm)", padding: "8px 10px",
                          marginBottom: 8,
                        }}>
                          <span style={{ flex: 1, fontSize: 12, color: "#374151", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            /api/portal?token={partner.portal_token}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(portalUrl).then(() => {
                                setLinkCopied(true);
                                setTimeout(() => setLinkCopied(false), 2000);
                              });
                            }}
                            style={{
                              flex: "none", fontSize: 12, fontWeight: 500,
                              color: linkCopied ? "var(--green-text)" : "var(--indigo)",
                              background: "none", border: "none", cursor: "pointer", padding: "0 4px",
                            }}
                          >
                            {linkCopied ? "Copied!" : "Copy"}
                          </button>
                        </div>
                        <a
                          href={mailto}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 5,
                            fontSize: 13, fontWeight: 500, color: "#fff",
                            background: "var(--indigo)", borderRadius: 6,
                            padding: "7px 14px", textDecoration: "none",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                            <polyline points="22,6 12,13 2,6"/>
                          </svg>
                          Send invite to {recipientEmail || "partner"}
                        </a>
                        <p className="small muted" style={{ marginTop: 6 }}>
                          Opens your email client with a pre-filled invite. The link logs the partner in directly — no password needed.
                        </p>
                      </div>
                    );
                  })() : (
                    <p className="small muted">
                      No link generated yet. Click <strong>Generate link</strong> above to create a unique portal access link for this partner.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Financial */}
            <div className="card" style={{ ...card, marginBottom: 0 }}>
              <p className="card-section-title" style={{ marginBottom: 4 }}>
                <LockIcon />Financial
              </p>
              <p className="small muted" style={{ margin: "0 0 10px" }}>
                Reference only — encrypted at rest in production.
              </p>
              <div className="grid cols-2" style={{ gap: 10 }}>
                <div className="field" style={fld}>
                  <label>Bank name</label>
                  <input name="bank_name" placeholder="First Chicago Bank" defaultValue={partner?.bank_name ?? ""} />
                </div>
                <SecretField
                  name="bank_account"
                  label="Bank account / IBAN"
                  placeholder="US00 0000 0000 0000"
                  defaultValue={partner?.bank_account ?? ""}
                  style={fld}
                />
                <SecretField
                  name="swift"
                  label="SWIFT / BIC"
                  placeholder="CHASUS33"
                  defaultValue={partner?.swift ?? ""}
                  style={{ marginBottom: 0 }}
                />
                <div className="field" style={{ marginBottom: 0 }}>
                  <label>Payment terms</label>
                  <select name="payment_terms" defaultValue={partner?.payment_terms ?? ""}>
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
        </div>

        {/* ── Products ── */}
        <div className="card" style={{ ...card, marginTop: 16, marginBottom: 0 }}>
          <p className="card-section-title" style={{ marginBottom: 4 }}>Products</p>
          <p className="small muted" style={{ margin: "0 0 12px" }}>
            Products this partner offers, with minimum order quantity, typical delivery time, and price.
          </p>
          <PartnerProducts defaultProducts={partner?.products ?? []} defaultImageUrls={productImageUrls ?? []} knownProducts={knownProducts} />
        </div>

        {showSaveUi && (
          <button
            className="btn"
            type="submit"
            disabled={saving}
            style={{
              marginTop: 16,
              marginBottom: showSaveUi ? 64 : 0,
              opacity: saving ? 0.75 : 1,
              cursor: saving ? "wait" : "pointer",
            }}
          >
            {saving ? "Saving…" : partner ? "Save changes" : "Add partner"}
          </button>
        )}
      </form>

      {/* Sticky unsaved-changes / saving bar — only while editing or mid-save */}
      {showSaveUi && (
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            background: "#fff",
            borderTop: "1px solid var(--border)",
            padding: "10px 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 -2px 16px rgba(16,24,40,0.09)",
          }}
        >
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              fontSize: 13,
              color: saving ? "var(--indigo)" : "var(--amber-text)",
              fontWeight: 500,
            }}
          >
            {saving ? (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
                Saving changes…
              </>
            ) : (
              <>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                Unsaved changes
              </>
            )}
          </span>
          <button
            type="button"
            className="btn"
            disabled={saving}
            style={{
              padding: "8px 22px",
              opacity: saving ? 0.75 : 1,
              cursor: saving ? "wait" : "pointer",
            }}
            onClick={() => formRef.current?.requestSubmit()}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
    </>
  );
}
