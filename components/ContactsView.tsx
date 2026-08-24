"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PartnerContact } from "@/lib/types";

type ContactRow = PartnerContact & { partners: { id: number; company: string } | null };

type Props = {
  contacts: ContactRow[];
  partnerOptions: { id: number; company: string }[];
  saveContact: (fd: FormData) => Promise<{ error?: string }>;
  deleteContact: (id: number, partnerId: number) => Promise<void>;
};

const inp: React.CSSProperties = {
  height: 34, padding: "0 10px", border: "1px solid var(--border)",
  borderRadius: 7, fontSize: 13, fontFamily: "inherit", outline: "none",
  background: "#fff", width: "100%", boxSizing: "border-box",
};

const btnGhost: React.CSSProperties = {
  height: 30, padding: "0 12px", fontSize: 12, whiteSpace: "nowrap",
  border: "1px solid var(--border)", borderRadius: 6, background: "#fff",
  cursor: "pointer", fontFamily: "inherit", color: "var(--text)",
};

export function ContactsView({ contacts, partnerOptions, saveContact, deleteContact }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const addFormRef = useRef<HTMLFormElement>(null);

  const filtered = search.trim()
    ? contacts.filter((c) => {
        const q = search.trim().toLowerCase();
        return (
          c.name.toLowerCase().includes(q) ||
          (c.partners?.company ?? "").toLowerCase().includes(q) ||
          (c.title ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q) ||
          (c.notes ?? "").toLowerCase().includes(q)
        );
      })
    : contacts;

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    let result: { error?: string } | undefined;
    try { result = await saveContact(fd); }
    catch { setSaving(false); setFormError("Unexpected error."); return; }
    setSaving(false);
    if (result?.error) { setFormError(result.error); }
    else { addFormRef.current?.reset(); setAdding(false); router.refresh(); }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, c: ContactRow) {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);
    const fd = new FormData(e.currentTarget);
    fd.append("contact_id", String(c.id));
    fd.append("partner_id", String(c.partner_id));
    let result: { error?: string } | undefined;
    try { result = await saveContact(fd); }
    catch { setEditSaving(false); setEditError("Unexpected error."); return; }
    setEditSaving(false);
    if (result?.error) { setEditError(result.error); }
    else { setEditingId(null); router.refresh(); }
  }

  async function handleDelete(c: ContactRow) {
    if (!confirm(`Remove ${c.name}?`)) return;
    setDeleting(c.id);
    await deleteContact(c.id, c.partner_id);
    setDeleting(null);
    router.refresh();
  }

  const thStyle: React.CSSProperties = {
    textAlign: "left", fontWeight: 600, fontSize: 12, color: "var(--muted)",
    textTransform: "uppercase", letterSpacing: "0.4px", whiteSpace: "nowrap",
    padding: "8px 10px", borderBottom: "1px solid var(--border)", background: "#fafafa",
  };
  const tdStyle: React.CSSProperties = {
    padding: "10px 10px", borderBottom: "1px solid var(--border)", verticalAlign: "middle",
  };

  return (
    <div>
      {/* ── Toolbar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, justifyContent: "space-between" }}>
        <input
          type="search"
          placeholder="Search contacts…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ ...inp, maxWidth: 280, height: 36 }}
        />
        {!adding && (
          <button type="button" className="btn"
            style={{ height: 36, padding: "0 16px", fontSize: 13, whiteSpace: "nowrap" }}
            onClick={() => setAdding(true)}>
            + Add contact
          </button>
        )}
      </div>

      {/* ── Add form ── */}
      {adding && (
        <form ref={addFormRef} onSubmit={handleAdd}
          style={{ background: "#f8faff", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
          {formError && <p style={{ margin: "0 0 6px", fontSize: 12, color: "#dc2626" }}>{formError}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1.4fr auto auto", gap: 8, alignItems: "end" }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Company *</label>
              <select name="partner_id" required style={{ ...inp, background: "#fff" }}>
                <option value="">— select —</option>
                {partnerOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.company}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Name *</label>
              <input name="con_name" required style={inp} placeholder="Jane Smith" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Title</label>
              <input name="con_title" style={inp} placeholder="Account Manager" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Email</label>
              <input name="con_email" type="email" style={inp} placeholder="jane@vendor.com" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Phone</label>
              <input name="con_phone" style={inp} placeholder="+1 555 000 0000" />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Comment</label>
              <input name="con_notes" style={inp} placeholder="Notes…" />
            </div>
            <button type="submit" className="btn" disabled={saving}
              style={{ height: 34, padding: "0 18px", fontSize: 13, whiteSpace: "nowrap" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => { setAdding(false); setFormError(null); }} style={{ ...btnGhost, height: 34 }}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <p className="muted small" style={{ padding: "20px 16px", margin: 0 }}>
            {search ? "No contacts match your search." : "No contacts yet. Add your first contact above."}
          </p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Company</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Title</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Phone</th>
                <th style={thStyle}>Comment</th>
                <th style={{ ...thStyle, width: 110 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) =>
                editingId === c.id ? (
                  <tr key={c.id} style={{ background: "#f8faff" }}>
                    <td colSpan={7} style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                      <form onSubmit={(e) => handleEdit(e, c)}>
                        {editError && <p style={{ margin: "0 0 6px", fontSize: 12, color: "#dc2626" }}>{editError}</p>}
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Company</label>
                            <select name="partner_id" required defaultValue={c.partner_id} style={{ ...inp, background: "#fff" }}>
                              {partnerOptions.map((p) => (
                                <option key={p.id} value={p.id}>{p.company}</option>
                              ))}
                            </select>
                          </div>
                          <input name="con_name" required defaultValue={c.name} style={inp} placeholder="Name *" />
                          <input name="con_title" defaultValue={c.title ?? ""} style={inp} placeholder="Title" />
                          <input name="con_email" type="email" defaultValue={c.email ?? ""} style={inp} placeholder="Email" />
                          <input name="con_phone" defaultValue={c.phone ?? ""} style={inp} placeholder="Phone" />
                          <button type="submit" className="btn" disabled={editSaving}
                            style={{ height: 34, padding: "0 14px", fontSize: 13 }}>
                            {editSaving ? "…" : "Update"}
                          </button>
                          <button type="button" onClick={() => { setEditingId(null); setEditError(null); }} style={{ ...btnGhost, height: 34 }}>
                            Cancel
                          </button>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" }}>
                          <textarea name="con_notes" rows={2} defaultValue={c.notes ?? ""}
                            style={{ ...inp, height: "auto", padding: "7px 10px", resize: "vertical" }}
                            placeholder="Comment / Notes" />
                          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer", paddingTop: 8, whiteSpace: "nowrap" }}>
                            <input type="checkbox" name="con_primary" value="1" defaultChecked={c.is_primary} style={{ accentColor: "var(--indigo)" }} />
                            Primary
                          </label>
                        </div>
                      </form>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} style={{ transition: "background .1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafbff")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "")}>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{c.partners?.company ?? "—"}</span>
                    </td>
                    <td style={tdStyle}>
                      <span style={{ fontWeight: 500 }}>{c.name}</span>
                      {c.is_primary && (
                        <span style={{
                          marginLeft: 6, fontSize: 10, fontWeight: 700,
                          background: "#ede9fe", color: "#6d28d9",
                          borderRadius: 10, padding: "1px 6px",
                        }}>Primary</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 13, color: "var(--muted)" }}>{c.title ?? "—"}</td>
                    <td style={{ ...tdStyle, fontSize: 13 }}>
                      {c.email ? (
                        <a href={`mailto:${c.email}`} style={{ color: "var(--indigo)", textDecoration: "none" }}>{c.email}</a>
                      ) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 13 }}>
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} style={{ color: "var(--text)", textDecoration: "none" }}>{c.phone}</a>
                      ) : "—"}
                    </td>
                    <td style={{ ...tdStyle, fontSize: 12, color: "var(--muted)", maxWidth: 220 }}>
                      <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                        {c.notes ?? "—"}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        <button type="button"
                          onClick={() => { setEditingId(c.id); setEditError(null); }}
                          style={btnGhost}>
                          Edit
                        </button>
                        <button type="button"
                          onClick={() => handleDelete(c)}
                          disabled={deleting === c.id}
                          style={{ ...btnGhost, color: "#dc2626", borderColor: "transparent" }}>
                          {deleting === c.id ? "…" : "Delete"}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <p className="small muted" style={{ marginTop: 8 }}>
          {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
          {search ? ` matching "${search}"` : ""}
        </p>
      )}
    </div>
  );
}
