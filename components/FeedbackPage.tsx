"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────────────────

const TYPES = [
  { value: "bug", label: "Bug" },
  { value: "feature_request", label: "New Feature/Idea" },
  { value: "question", label: "Question" },
  { value: "other", label: "Other" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  feature_request: "New Feature/Idea",
  question: "Question",
  other: "Other",
  improvement: "New Feature/Idea",
};

const TYPE_STYLE: Record<string, { bg: string; color: string }> = {
  bug:             { bg: "#fee2e2", color: "#dc2626" },
  feature_request: { bg: "#eff6ff", color: "#2563eb" },
  question:        { bg: "#f3e8ff", color: "#7c3aed" },
  other:           { bg: "#f1f5f9", color: "#64748b" },
  improvement:     { bg: "#eff6ff", color: "#2563eb" },
};

const STATUSES = [
  { value: "open",      label: "Open" },
  { value: "in_review", label: "In Review" },
  { value: "planned",   label: "Planned" },
  { value: "done",      label: "Done" },
  { value: "declined",  label: "Declined" },
] as const;

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  open:      { bg: "#f1f5f9", color: "#64748b" },
  in_review: { bg: "#eff6ff", color: "#2563eb" },
  planned:   { bg: "#fef3c7", color: "#b45309" },
  done:      { bg: "#dcfce7", color: "#16a34a" },
  declined:  { bg: "#fee2e2", color: "#dc2626" },
};

const PAGE_OPTIONS = [
  "Board", "Job Card", "Email", "Packing Slip (PDF)", "Job Ticket",
  "SMS Ready to Production", "Shipping Ready", "Missing Info",
  "Approval Request", "Analytics", "Time Tracking", "Navigation / Sidebar", "Other",
];

// ── Types ────────────────────────────────────────────────────────────────────

interface FeedbackImage {
  id: string;
  file_name: string;
  mime_type: string;
  url: string | null;
}

interface FeedbackItem {
  id: string;
  user_id: number;
  display_name: string;
  type: string;
  page: string;
  title: string;
  comment: string;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  is_own: boolean;
  images: FeedbackImage[];
}

// ── Image compression (client-side) ─────────────────────────────────────────

async function compressImage(file: File): Promise<File> {
  const MAX_DIM = 1200;
  const QUALITY = 0.82;
  const MAX_BYTES = 10 * 1024 * 1024;

  if (!file.type.startsWith("image/")) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const objUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objUrl);
      let { width, height } = img;
      const ratio = Math.min(1, MAX_DIM / width, MAX_DIM / height);
      if (ratio === 1 && file.size <= MAX_BYTES) return resolve(file);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
        },
        "image/jpeg",
        QUALITY
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objUrl); resolve(file); };
    img.src = objUrl;
  });
}

// ── Pill badges ──────────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const s = TYPE_STYLE[type] ?? TYPE_STYLE.other;
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: s.bg, color: s.color }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.open;
  const label = STATUSES.find((x) => x.value === status)?.label ?? status;
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap", background: s.bg, color: s.color }}>
      {label}
    </span>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface Props {
  isAdmin: boolean;
  currentUserId: number;
}

const EMPTY_FORM = { type: "bug", page: "", title: "", comment: "" };

export function FeedbackPage({ isAdmin, currentUserId }: Props) {
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<FeedbackItem | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Admin per-row
  const [adminNoteEdit, setAdminNoteEdit] = useState<Record<string, string>>({});
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [statusSavingId, setStatusSavingId] = useState<string | null>(null);

  // Lightbox
  const [lightbox, setLightbox] = useState<{ images: FeedbackImage[]; idx: number } | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/feedback");
      if (!res.ok) return;
      const { items: data } = await res.json();
      setItems(data ?? []);
      // Dispatch count change event
      window.dispatchEvent(new CustomEvent("workflow:feedback-count-changed", { detail: { count: (data ?? []).length } }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
    const onFocus = () => fetchItems();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [fetchItems]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setPendingFiles([]);
    setModalOpen(true);
  }

  function openEdit(item: FeedbackItem) {
    setEditItem(item);
    setForm({ type: item.type, page: item.page, title: item.title, comment: item.comment });
    setPendingFiles([]);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditItem(null);
    setPendingFiles([]);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const existingCount = (editItem?.images.length ?? 0) + pendingFiles.length;
    const room = 5 - existingCount;
    if (room <= 0) return;
    const valid = Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, room);
    setPendingFiles((prev) => [...prev, ...valid]);
  }

  async function doUploadImages(feedbackId: string, files: File[]) {
    for (const raw of files) {
      const compressed = await compressImage(raw);
      const fd = new FormData();
      fd.append("file", compressed);
      await fetch(`/api/feedback/${feedbackId}/images`, { method: "POST", body: fd });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { type, page, title, comment } = form;
    if (!type || !page || !title.trim() || !comment.trim()) return;
    setSaving(true);
    try {
      let feedbackId: string;
      if (editItem) {
        const res = await fetch(`/api/feedback/${editItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, page, title: title.trim(), comment: comment.trim() }),
        });
        if (!res.ok) return;
        feedbackId = editItem.id;
      } else {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, page, title: title.trim(), comment: comment.trim() }),
        });
        if (!res.ok) return;
        const { item } = await res.json();
        feedbackId = item.id;
      }
      if (pendingFiles.length) {
        setUploading(true);
        await doUploadImages(feedbackId, pendingFiles);
        setUploading(false);
      }
      await fetchItems();
      closeModal();
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  // ── Admin actions ──────────────────────────────────────────────────────────

  async function handleStatusChange(id: string, status: string) {
    setStatusSavingId(id);
    await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status } : i));
    setStatusSavingId(null);
  }

  async function handleAdminNoteSave(id: string) {
    const note = adminNoteEdit[id] ?? "";
    await fetch(`/api/feedback/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ admin_note: note }),
    });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, admin_note: note || null } : i));
    setEditingNoteId(null);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/feedback/${id}`, { method: "DELETE" });
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeleteId(null);
  }

  async function handleDeleteImage(feedbackId: string, imageId: string) {
    await fetch(`/api/feedback/${feedbackId}/images/${imageId}`, { method: "DELETE" });
    setItems((prev) => prev.map((i) =>
      i.id === feedbackId ? { ...i, images: i.images.filter((img) => img.id !== imageId) } : i
    ));
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return <p className="muted" style={{ marginTop: 40, textAlign: "center" }}>Loading…</p>;
  }

  return (
    <div>
      {/* Header */}
      <div className="page-head" style={{ marginBottom: 24 }}>
        <div>
          <h1>Feedback &amp; Improvements</h1>
          <p>Share ideas, report bugs, or request features</p>
        </div>
        <button className="btn" onClick={openCreate}>Submit</button>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {items.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--muted)" }}>
            No feedback yet — be the first to submit!
          </div>
        ) : (
          <table className="data" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th style={{ width: 36 }} />
                <th>Type</th>
                <th>Title</th>
                <th>Page / Section</th>
                <th>Status</th>
                <th>Submitted by</th>
                <th>Date</th>
                <th style={{ width: 72 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <React.Fragment key={item.id}>
                  {/* Main row */}
                  <tr style={{ cursor: "pointer" }}>
                    <td
                      onClick={() => toggleExpand(item.id)}
                      style={{ textAlign: "center", padding: "10px 8px", color: "var(--muted)" }}
                    >
                      <svg
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5"
                        style={{ display: "block", margin: "0 auto", transition: "transform .15s", transform: expanded.has(item.id) ? "rotate(90deg)" : "none" }}
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </td>
                    <td onClick={() => toggleExpand(item.id)}>
                      <TypeBadge type={item.type} />
                    </td>
                    <td onClick={() => toggleExpand(item.id)}>
                      <span style={{ fontWeight: 600 }}>{item.title}</span>
                      {item.images.length > 0 && (
                        <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 600, background: "#f1f5f9", color: "#64748b", borderRadius: 999, padding: "1px 7px" }}>
                          📎 {item.images.length}
                        </span>
                      )}
                    </td>
                    <td onClick={() => toggleExpand(item.id)} style={{ color: "var(--muted)", fontSize: 13 }}>
                      {item.page}
                    </td>
                    <td onClick={() => toggleExpand(item.id)}>
                      <StatusBadge status={item.status} />
                    </td>
                    <td onClick={() => toggleExpand(item.id)} style={{ color: "var(--muted)", fontSize: 13 }}>
                      {item.display_name}
                    </td>
                    <td onClick={() => toggleExpand(item.id)} style={{ color: "var(--muted)", fontSize: 13 }}>
                      {fmtDate(item.created_at)}
                      {item.updated_at !== item.created_at && (
                        <div style={{ fontSize: 11 }}>edited</div>
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                        {item.is_own && (
                          <button
                            title="Edit"
                            onClick={(e) => { e.stopPropagation(); openEdit(item); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)", padding: 5, borderRadius: 6, lineHeight: 1 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {isAdmin && (
                          <button
                            title="Delete"
                            onClick={(e) => { e.stopPropagation(); setDeleteId(item.id); }}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--red)", padding: 5, borderRadius: 6, lineHeight: 1 }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded row */}
                  {expanded.has(item.id) && (
                    <tr style={{ background: "#f9fafb" }}>
                      <td colSpan={8} style={{ padding: "16px 20px 20px 48px", borderTop: "1px solid var(--border-soft)" }}>

                        {/* Comment */}
                        <p style={{ margin: "0 0 14px", whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 14 }}>
                          {item.comment}
                        </p>

                        {/* Thumbnails */}
                        {item.images.length > 0 && (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                            {item.images.map((img, idx) => (
                              <div key={img.id} style={{ position: "relative", flexShrink: 0 }}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={img.url ?? ""}
                                  alt={img.file_name}
                                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: "1px solid var(--border)", display: "block" }}
                                  onClick={() => setLightbox({ images: item.images, idx })}
                                />
                                {(item.is_own || isAdmin) && (
                                  <button
                                    onClick={() => handleDeleteImage(item.id, img.id)}
                                    style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1 }}
                                  >×</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Admin note (read-only for non-admins) */}
                        {!isAdmin && item.admin_note && (
                          <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 8 }}>
                            <strong style={{ color: "var(--indigo)" }}>Admin note: </strong>
                            {item.admin_note}
                          </div>
                        )}

                        {/* Admin controls */}
                        {isAdmin && (
                          <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", marginTop: 4, paddingTop: 12, borderTop: "1px solid var(--border)" }}>
                            {/* Status */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--muted)" }}>Status</span>
                              <select
                                value={item.status}
                                disabled={statusSavingId === item.id}
                                onChange={(e) => handleStatusChange(item.id, e.target.value)}
                                style={{ fontSize: 13, padding: "5px 8px", borderRadius: 7, border: "1px solid var(--border)", fontFamily: "inherit", cursor: "pointer" }}
                              >
                                {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                              </select>
                            </div>

                            {/* Admin note editor */}
                            <div style={{ flex: 1, minWidth: 220 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.4px", color: "var(--muted)", display: "block", marginBottom: 5 }}>Internal note</span>
                              {editingNoteId === item.id ? (
                                <div style={{ display: "flex", gap: 8 }}>
                                  <textarea
                                    rows={2}
                                    value={adminNoteEdit[item.id] ?? ""}
                                    onChange={(e) => setAdminNoteEdit((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    style={{ flex: 1, fontSize: 13, padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 7, fontFamily: "inherit", resize: "vertical" }}
                                  />
                                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                                    <button className="btn sm" onClick={() => handleAdminNoteSave(item.id)}>Save</button>
                                    <button className="btn ghost sm" onClick={() => setEditingNoteId(null)}>Cancel</button>
                                  </div>
                                </div>
                              ) : (
                                <div
                                  onClick={() => { setAdminNoteEdit((prev) => ({ ...prev, [item.id]: item.admin_note ?? "" })); setEditingNoteId(item.id); }}
                                  style={{ fontSize: 13, padding: "7px 10px", border: "1px dashed var(--border)", borderRadius: 7, cursor: "pointer", color: item.admin_note ? "var(--text)" : "var(--muted)", minHeight: 38 }}
                                >
                                  {item.admin_note ?? "Click to add a note…"}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Create / Edit Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", padding: 28, boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}>
            <h2 style={{ margin: "0 0 22px", fontSize: 20, fontWeight: 800 }}>
              {editItem ? "Edit feedback" : "Submit feedback"}
            </h2>
            <form onSubmit={handleSubmit}>

              {/* Type */}
              <div className="field">
                <label>Type *</label>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                  {TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                      style={{
                        padding: "6px 14px", borderRadius: 7, cursor: "pointer",
                        fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                        border: `1.5px solid ${form.type === t.value ? "var(--indigo)" : "var(--border)"}`,
                        background: form.type === t.value ? "var(--indigo-50)" : "#fff",
                        color: form.type === t.value ? "var(--indigo)" : "var(--text)",
                        transition: "all .1s",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Page */}
              <div className="field">
                <label>Page / Section *</label>
                <select required value={form.page} onChange={(e) => setForm((f) => ({ ...f, page: e.target.value }))}>
                  <option value="">— select page —</option>
                  {PAGE_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>

              {/* Title */}
              <div className="field">
                <label>Title *</label>
                <input
                  required
                  maxLength={200}
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Brief summary"
                />
              </div>

              {/* Description */}
              <div className="field">
                <label>Description *</label>
                <textarea
                  required
                  rows={4}
                  value={form.comment}
                  onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                  placeholder="Describe the issue or idea in detail…"
                  style={{ resize: "vertical" }}
                />
              </div>

              {/* Screenshots */}
              <div className="field">
                <label>
                  Screenshots
                  <span className="small muted" style={{ marginLeft: 6 }}>
                    {(editItem?.images.length ?? 0) + pendingFiles.length}/5
                  </span>
                </label>

                {/* Existing images (edit) */}
                {editItem && editItem.images.length > 0 && (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                    {editItem.images.map((img) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={img.id} src={img.url ?? ""} alt={img.file_name}
                        style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)" }} />
                    ))}
                  </div>
                )}

                {/* Pending previews */}
                {pendingFiles.length > 0 && (
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                    {pendingFiles.map((f, i) => (
                      <div key={i} style={{ position: "relative" }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={URL.createObjectURL(f)}
                          alt={f.name}
                          style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--border)", display: "block" }}
                        />
                        <button
                          type="button"
                          onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                          style={{ position: "absolute", top: -4, right: -4, width: 16, height: 16, borderRadius: "50%", background: "#dc2626", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >×</button>
                      </div>
                    ))}
                  </div>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: "none" }}
                  onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }}
                />
                {((editItem?.images.length ?? 0) + pendingFiles.length) < 5 && (
                  <button type="button" className="btn ghost sm" onClick={() => fileRef.current?.click()}>
                    + Add screenshot
                  </button>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button type="button" className="btn ghost" onClick={closeModal}>Cancel</button>
                <button type="submit" className="btn" disabled={saving || uploading}>
                  {uploading ? "Uploading…" : saving ? "Saving…" : editItem ? "Save changes" : "Submit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1001, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 28, maxWidth: 380, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,.18)" }}>
            <h3 style={{ margin: "0 0 8px" }}>Delete this feedback?</h3>
            <p style={{ margin: "0 0 22px", color: "var(--muted)" }}>This permanently deletes the item and all its images. This cannot be undone.</p>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn ghost" onClick={() => setDeleteId(null)}>Cancel</button>
              <button className="btn danger" onClick={() => handleDelete(deleteId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ────────────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: "fixed", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 36, height: 36, color: "#fff", fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>

          {lightbox.idx > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => l ? { ...l, idx: l.idx - 1 } : null); }}
              style={{ position: "fixed", left: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "#fff", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >‹</button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightbox.images[lightbox.idx]?.url ?? ""}
            alt=""
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", objectFit: "contain", borderRadius: 8, display: "block" }}
          />

          {lightbox.idx < lightbox.images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setLightbox((l) => l ? { ...l, idx: l.idx + 1 } : null); }}
              style={{ position: "fixed", right: 16, top: "50%", transform: "translateY(-50%)", background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", width: 44, height: 44, color: "#fff", fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
            >›</button>
          )}

          {lightbox.images.length > 1 && (
            <div style={{ position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", color: "rgba(255,255,255,.65)", fontSize: 13 }}>
              {lightbox.idx + 1} / {lightbox.images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
