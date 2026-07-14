"use client";

import { useRef, useState, useTransition } from "react";

type FeedbackDimension = {
  key: "quality_rating" | "quantity_rating" | "satisfaction_rating" | "timing_rating";
  label: string;
  description: string;
  icon: string;
};

const DIMENSIONS: FeedbackDimension[] = [
  { key: "quality_rating",       label: "Quality",       description: "Was the product quality up to standard?",   icon: "✦" },
  { key: "quantity_rating",      label: "Quantity",      description: "Was the delivered quantity correct?",        icon: "⊞" },
  { key: "satisfaction_rating",  label: "Customer",      description: "Was the customer satisfied with the order?", icon: "◉" },
  { key: "timing_rating",        label: "Timing",        description: "Was the order delivered on time?",           icon: "◷" },
];

function StarPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  return (
    <span style={{ display: "inline-flex", gap: 3 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= (hover || value);
        return (
          <button
            key={n}
            type="button"
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            title={`${n} star${n !== 1 ? "s" : ""}`}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 24, lineHeight: 1, padding: "1px 2px",
              color: filled ? "#f59e0b" : "#d1d5db",
              transition: "color .1s",
            }}
          >
            ★
          </button>
        );
      })}
      {/* Hidden real input for form submission */}
      <input type="hidden" name={name} value={value || ""} />
    </span>
  );
}

export type FeedbackPayload = {
  dispatch_id: number;
  partner_id: number;
  request_id: number;
  quality_rating: number | null;
  quantity_rating: number | null;
  satisfaction_rating: number | null;
  timing_rating: number | null;
  feedback_notes: string | null;
};

type Props = {
  requestTitle: string;
  dispatchId: number;
  partnerId: number;
  requestId: number;
  existing: {
    quality_rating: number | null;
    quantity_rating: number | null;
    satisfaction_rating: number | null;
    timing_rating: number | null;
    feedback_notes: string | null;
  } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFeedback: (formData: FormData) => Promise<any>;
  onClose: () => void;
};

export function FeedbackModal({
  requestTitle,
  dispatchId,
  partnerId,
  requestId,
  existing,
  saveFeedback,
  onClose,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const [ratings, setRatings] = useState<Record<string, number>>({
    quality_rating: existing?.quality_rating ?? 0,
    quantity_rating: existing?.quantity_rating ?? 0,
    satisfaction_rating: existing?.satisfaction_rating ?? 0,
    timing_rating: existing?.timing_rating ?? 0,
  });
  const [notes, setNotes] = useState(existing?.feedback_notes ?? "");

  const overall =
    Object.values(ratings).some((v) => v > 0)
      ? Object.values(ratings).filter((v) => v > 0).reduce((a, b) => a + b, 0) /
        Object.values(ratings).filter((v) => v > 0).length
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    // Inject the hidden state-backed values
    fd.set("dispatch_id", String(dispatchId));
    fd.set("partner_id", String(partnerId));
    fd.set("request_id", String(requestId));
    fd.set("notes", notes);
    Object.entries(ratings).forEach(([k, v]) => {
      if (v > 0) fd.set(k, String(v));
    });
    startTransition(async () => {
      await saveFeedback(fd);
      setSaved(true);
      setTimeout(onClose, 900);
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "min(560px, 100%)", maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          padding: 0, overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Order Feedback</div>
            <div className="small muted" style={{ marginTop: 2 }}>{requestTitle}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, color: "var(--muted)", padding: "2px 6px", flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <div style={{ overflowY: "auto", padding: "20px" }}>
          {saved ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#16a34a", fontWeight: 600, fontSize: 16 }}>
              ✓ Feedback saved!
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit}>
              {/* Hidden IDs */}
              <input type="hidden" name="dispatch_id" value={dispatchId} />
              <input type="hidden" name="partner_id" value={partnerId} />
              <input type="hidden" name="request_id" value={requestId} />

              {/* Dimension ratings */}
              <div style={{ display: "flex", flexDirection: "column", gap: 18, marginBottom: 20 }}>
                {DIMENSIONS.map((dim) => (
                  <div key={dim.key} style={{
                    background: "#fafafa", border: "1px solid var(--border)",
                    borderRadius: 8, padding: "12px 14px",
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 16, color: "var(--indigo)" }}>{dim.icon}</span>
                        {dim.label}
                      </div>
                      <div className="small muted" style={{ marginTop: 2 }}>{dim.description}</div>
                    </div>
                    <StarPicker
                      name={dim.key}
                      value={ratings[dim.key]}
                      onChange={(v) => setRatings((p) => ({ ...p, [dim.key]: v }))}
                    />
                  </div>
                ))}
              </div>

              {/* Overall preview */}
              {overall != null && (
                <div style={{
                  background: "linear-gradient(135deg,#fffbeb,#fef3c7)",
                  border: "1px solid #fcd34d", borderRadius: 8,
                  padding: "10px 14px", marginBottom: 18,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontWeight: 600, fontSize: 13, color: "#92400e" }}>Overall score</span>
                  <span style={{ fontWeight: 700, fontSize: 20, color: "#d97706" }}>
                    {overall.toFixed(1)}
                    <span style={{ fontSize: 13, fontWeight: 400, color: "#92400e", marginLeft: 3 }}>/ 5</span>
                  </span>
                </div>
              )}

              {/* Notes */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  Comments <span className="muted" style={{ fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea
                  name="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any notes about this order delivery…"
                  style={{
                    width: "100%", padding: "8px 12px",
                    border: "1px solid var(--border)", borderRadius: 8,
                    fontFamily: "inherit", fontSize: 14, resize: "vertical",
                    background: "#fff", color: "var(--text)",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Submit */}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn ghost" onClick={onClose} disabled={isPending}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={isPending || Object.values(ratings).every((v) => v === 0)}
                >
                  {isPending ? "Saving…" : existing?.quality_rating ? "Update feedback" : "Save feedback"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
