"use client";

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { STATUS_LABELS, STATUS_ORDER } from "@/lib/types";

type Props = {
  requestId: number;
  currentStatus: string;
  awaitingCount: number;
  partnerCount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendReminder: (fd: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateStatus: (fd: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  duplicate: (fd: FormData) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteReq: (fd: FormData) => Promise<any>;
};

const CHANGEABLE_STATUSES = STATUS_ORDER.filter((s) => s !== "closed");

export function RequestActionsMenu({
  requestId,
  currentStatus,
  awaitingCount,
  partnerCount,
  sendReminder,
  updateStatus,
  duplicate,
  deleteReq,
}: Props) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState<{ top: number; right: number } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Calculate fixed position when opening
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropPos({
      top: rect.bottom + 6,
      right: window.innerWidth - rect.right,
    });
  }, [open]);

  // Reposition on scroll/resize while open
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open]);

  // Close on click-outside and Escape
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      const outsideBtn = ref.current && !ref.current.contains(target);
      const outsideDropdown = dropdownRef.current && !dropdownRef.current.contains(target);
      if (outsideBtn && outsideDropdown) {
        setOpen(false);
        setConfirmClose(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setConfirmClose(false); }
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  function toggle() {
    setOpen((o) => {
      if (o) setConfirmClose(false); // reset confirm when closing
      return !o;
    });
  }

  function callAction(action: (fd: FormData) => Promise<unknown>, fields: Record<string, string>) {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.set(k, v));
    startTransition(async () => { await action(fd); });
    setOpen(false);
    setConfirmClose(false);
  }

  const isClosed = currentStatus === "closed";

  const dropdown = open && dropPos ? (
    <div
      ref={dropdownRef}
      style={{
        position: "fixed",
        top: dropPos.top,
        right: dropPos.right,
        zIndex: 9999,
        background: "#fff", border: "1px solid var(--border)", borderRadius: 10,
        boxShadow: "0 8px 28px rgba(0,0,0,0.13)", minWidth: 220, padding: "6px 0",
        animation: "dropdownFadeIn .12s ease",
      }}
    >
      <style>{`
        @keyframes dropdownFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

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
                  padding: "1px 6px", lineHeight: 1.6,
                }}>
                  {awaitingCount}
                </span>
              </span>
            </button>
          )}

          {/* ── Status change ─────────────────── */}
          {!isClosed && (
            <>
              <div style={{
                padding: "6px 14px 3px", fontSize: 10, fontWeight: 700,
                textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--muted)",
              }}>
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
          <div style={{ borderTop: "1px solid var(--border)", margin: "5px 0" }} />

          {/* ── Duplicate ─────────────────────── */}
          <button
            type="button"
            className="action-item"
            onClick={() => callAction(duplicate, { id: String(requestId) })}
          >
            <span style={{ fontSize: 14 }}>📄</span>
            <span>Duplicate request</span>
          </button>

          {/* ── Delete (no partners) or Close (has partners) ── */}
          {partnerCount === 0 ? (
            // Safe to hard-delete — no dispatches exist
            confirmClose ? (
              <button
                type="button"
                className="action-item danger"
                onClick={() => callAction(deleteReq, { id: String(requestId) })}
              >
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span>Confirm — delete permanently</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-item danger"
                onClick={() => setConfirmClose(true)}
              >
                <span style={{ fontSize: 14 }}>🗑</span>
                <span>Delete request</span>
              </button>
            )
          ) : !isClosed ? (
            // Has partners — offer close/archive only
            confirmClose ? (
              <button
                type="button"
                className="action-item danger"
                onClick={() => callAction(updateStatus, { id: String(requestId), status: "closed" })}
              >
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span>Confirm — close request</span>
              </button>
            ) : (
              <button
                type="button"
                className="action-item danger"
                onClick={() => setConfirmClose(true)}
              >
                <span style={{ fontSize: 14 }}>✕</span>
                <span>Close request</span>
              </button>
            )
          ) : null}
    </div>
  ) : null;

  return (
    <div ref={ref} style={{ display: "inline-block" }}>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={isPending}
        title="Actions"
        style={{
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "5px 10px",
          border: `1px solid ${open ? "var(--indigo)" : "var(--border)"}`,
          borderRadius: 6,
          background: open ? "var(--indigo-50)" : "#fff",
          cursor: "pointer",
          fontSize: 12, fontWeight: 600,
          color: open ? "var(--indigo)" : "var(--text)",
          fontFamily: "inherit",
          opacity: isPending ? 0.6 : 1,
          transition: "border-color .12s, background .12s, color .12s",
        }}
      >
        {isPending ? "…" : "Actions"}
        <svg
          width="10" height="10" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ transition: "transform .15s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {typeof document !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </div>
  );
}
