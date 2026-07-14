"use client";

import { useRef, useState, useTransition } from "react";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";

type Props = {
  requestId: number;
  currentStatus: string;
  awaitingCount: number; // partners dispatched but no quote yet
  // server actions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendReminder: (fd: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateStatus: (fd: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  duplicate: (fd: FormData) => Promise<any>;
};

const CHANGEABLE_STATUSES = STATUS_ORDER.filter((s) => s !== "closed");

export function RequestActionsMenu({
  requestId,
  currentStatus,
  awaitingCount,
  sendReminder,
  updateStatus,
  duplicate,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();

  function callAction(action: (fd: FormData) => Promise<unknown>, fields: Record<string, string>) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    startTransition(() => action(fd));
    setOpen(false);
  }

  const isClosed = currentStatus === "closed";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        title="Actions"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px", border: "1px solid var(--border)",
          borderRadius: 6, background: "#fff", cursor: "pointer",
          fontSize: 12, fontWeight: 600, color: "var(--text)",
          fontFamily: "inherit",
          opacity: isPending ? 0.6 : 1,
        }}
      >
        {isPending ? "…" : "Actions"}
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 100,
            background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
            boxShadow: "0 6px 24px rgba(0,0,0,0.12)", minWidth: 210, padding: "6px 0",
          }}
          onMouseLeave={() => { setOpen(false); setConfirmClose(false); }}
        >
          {/* ── Reminder ──────────────────────── */}
          {awaitingCount > 0 && !isClosed && (
            <button
              type="button"
              className="action-item"
              onClick={() => callAction(sendReminder, { request_id: String(requestId) })}
            >
              <span style={{ fontSize: 14 }}>📩</span>
              <span>
                Remind partners
                <span style={{
                  marginLeft: 6, background: "#dc2626", color: "#fff",
                  borderRadius: 999, fontSize: 10, fontWeight: 700,
                  padding: "1px 5px", lineHeight: 1.5,
                }}>
                  {awaitingCount}
                </span>
              </span>
            </button>
          )}

          {/* ── Status change ─────────────────── */}
          {!isClosed && (
            <>
              <div style={{ padding: "5px 14px 3px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--muted)" }}>
                Change status
              </div>
              {CHANGEABLE_STATUSES.filter((s) => s !== currentStatus).map((s) => (
                <button
                  key={s}
                  type="button"
                  className="action-item"
                  onClick={() => callAction(updateStatus, { id: String(requestId), status: s })}
                >
                  <span style={{ fontSize: 14 }}>
                    {s === "sent" ? "📤" : s === "quoting" ? "💬" : s === "clarifying" ? "❓" : s === "awarded" ? "🏆" : "📋"}
                  </span>
                  <span>→ {STATUS_LABELS[s]}</span>
                </button>
              ))}
            </>
          )}

          {/* ── Separator ─────────────────────── */}
          <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

          {/* ── Duplicate ─────────────────────── */}
          <button
            type="button"
            className="action-item"
            onClick={() => callAction(duplicate, { id: String(requestId) })}
          >
            <span style={{ fontSize: 14 }}>📄</span>
            <span>Duplicate request</span>
          </button>

          {/* ── Close / Archive ───────────────── */}
          {!isClosed && (
            confirmClose ? (
              <button
                type="button"
                className="action-item danger"
                onClick={() => callAction(updateStatus, { id: String(requestId), status: "closed" })}
              >
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span>Confirm close</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-item"
                onClick={() => setConfirmClose(true)}
                style={{ color: "#dc2626" }}
              >
                <span style={{ fontSize: 14 }}>✕</span>
                <span>Close request</span>
              </button>
            )
          )}
        </div>
      )}
    </div>
  );
}
