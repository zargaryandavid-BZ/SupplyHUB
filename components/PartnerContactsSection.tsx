"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { PartnerContact } from "@/lib/types";

type Props = {
  partnerId: number;
  contacts: PartnerContact[];
  saveContact: (fd: FormData) => Promise<{ error?: string }>;
  deleteContact: (id: number, partnerId: number) => Promise<void>;
};

export function PartnerContactsSection({ partnerId, contacts, saveContact, deleteContact }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const addFormRef = useRef<HTMLFormElement>(null);

  async function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    fd.append("partner_id", String(partnerId));
    let result: { error?: string } | undefined;
    try { result = await saveContact(fd); } catch { setSaving(false); setFormError("Unexpected error."); return; }
    setSaving(false);
    if (result?.error) { setFormError(result.error); } else { addFormRef.current?.reset(); setAdding(false); router.refresh(); }
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>, id: number) {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);
    const fd = new FormData(e.currentTarget);
    fd.append("contact_id", String(id));
    fd.append("partner_id", String(partnerId));
    let result: { error?: string } | undefined;
    try { result = await saveContact(fd); } catch { setEditSaving(false); setEditError("Unexpected error."); return; }
    setEditSaving(false);
    if (result?.error) { setEditError(result.error); } else { setEditingId(null); router.refresh(); }
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    await deleteContact(id, partnerId);
    setDeleting(null);
    router.refresh();
  }

  const inp: React.CSSProperties = {
    height: 32, padding: "0 9px", border: "1px solid var(--border)",
    borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none",
    background: "#fff", width: "100%", boxSizing: "border-box",
  };
  const btnGhost: React.CSSProperties = {
    height: 28, padding: "0 10px", fontSize: 12, whiteSpace: "nowrap",
    border: "1px solid var(--border)", borderRadius: 5, background: "#fff",
    cursor: "pointer", fontFamily: "inherit", color: "var(--text)",
  };

  return (
    <div className="card" style={{ padding: "16px 18px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <p className="card-section-title" style={{ margin: 0 }}>Contacts</p>
          <p className="small muted" style={{ margin: "2px 0 0" }}>People at this vendor you can reach out to.</p>
        </div>
        {!adding && (
          <button type="button" className="btn"
            style={{ fontSize: 12, padding: "5px 14px", height: 30 }}
            onClick={() => setAdding(true)}>
            + Add contact
          </button>
        )}
      </div>

      {adding && (
        <form ref={addFormRef} onSubmit={handleAdd}
          style={{ background: "#f8faff", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          {formError && <p style={{ margin: "0 0 8px", fontSize: 12, color: "#dc2626" }}>{formError}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
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
            <button type="submit" className="btn" disabled={saving}
              style={{ height: 32, padding: "0 16px", fontSize: 13, whiteSpace: "nowrap" }}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setAdding(false)} style={{ ...btnGhost, height: 32 }}>Cancel</button>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", display: "block", marginBottom: 3 }}>Notes</label>
            <textarea name="con_notes" rows={2} style={{ ...inp, height: "auto", padding: "6px 9px", resize: "vertical" }}
              placeholder="Best time to reach, preferred method, etc." />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, cursor: "pointer" }}>
            <input type="checkbox" name="con_primary" value="1" style={{ accentColor: "var(--indigo)" }} />
            Mark as primary contact
          </label>
        </form>
      )}

      {contacts.length === 0 ? (
        <p className="muted small" style={{ margin: 0 }}>No contacts yet. Add your first contact above.</p>
      ) : (
        <table className="data" style={{ marginBottom: 0 }}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Title</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Notes</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) =>
              editingId === c.id ? (
                <tr key={c.id} style={{ background: "#f8faff" }}>
                  <td colSpan={6} style={{ padding: "10px 8px" }}>
                    <form onSubmit={(e) => handleEdit(e, c.id)}>
                      {editError && <p style={{ margin: "0 0 6px", fontSize: 12, color: "#dc2626" }}>{editError}</p>}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto auto", gap: 8, marginBottom: 8, alignItems: "center" }}>
                        <input name="con_name" required defaultValue={c.name} style={inp} placeholder="Name *" />
                        <input name="con_title" defaultValue={c.title ?? ""} style={inp} placeholder="Title" />
                        <input name="con_email" type="email" defaultValue={c.email ?? ""} style={inp} placeholder="Email" />
                        <input name="con_phone" defaultValue={c.phone ?? ""} style={inp} placeholder="Phone" />
                        <button type="submit" className="btn" disabled={editSaving}
                          style={{ height: 32, padding: "0 14px", fontSize: 13, whiteSpace: "nowrap" }}>
                          {editSaving ? "Saving…" : "Update"}
                        </button>
                        <button type="button" onClick={() => { setEditingId(null); setEditError(null); }} style={{ ...btnGhost, height: 32 }}>Cancel</button>
                      </div>
                      <textarea name="con_notes" rows={2} defaultValue={c.notes ?? ""}
                        style={{ ...inp, height: "auto", padding: "6px 9px", resize: "vertical" }}
                        placeholder="Notes" />
                      <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 13, cursor: "pointer" }}>
                        <input type="checkbox" name="con_primary" value="1" defaultChecked={c.is_primary} style={{ accentColor: "var(--indigo)" }} />
                        Primary contact
                      </label>
                    </form>
                  </td>
                </tr>
              ) : (
                <tr key={c.id}>
                  <td style={{ fontWeight: 500 }}>
                    {c.name}
                    {c.is_primary && (
                      <span style={{
                        marginLeft: 6, fontSize: 10, fontWeight: 700,
                        background: "#ede9fe", color: "#6d28d9",
                        borderRadius: 10, padding: "1px 6px",
                      }}>Primary</span>
                    )}
                  </td>
                  <td className="small">{c.title ?? "—"}</td>
                  <td className="small">
                    {c.email ? (
                      <a href={`mailto:${c.email}`} style={{ color: "var(--indigo)" }}>{c.email}</a>
                    ) : "—"}
                  </td>
                  <td className="small">{c.phone ?? "—"}</td>
                  <td className="small muted" style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.notes ?? "—"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                      <button type="button" onClick={() => { setEditingId(c.id); setEditError(null); }} style={btnGhost}>Edit</button>
                      <button type="button" onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                        style={{ ...btnGhost, color: "#dc2626", borderColor: "transparent" }}>
                        {deleting === c.id ? "Removing…" : "Remove"}
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
  );
}
