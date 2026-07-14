"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState, useTransition } from "react";

type Props = {
  requestId: number;
  requestTitle: string;
  partnerCount: number;
  defaultMessage: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  notifyAction: (formData: FormData) => Promise<any>;
};

export function NotifyPartnersModal({
  requestId,
  requestTitle,
  partnerCount,
  defaultMessage,
  notifyAction,
}: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const formRef = useRef<HTMLFormElement>(null);

  const isOpen = searchParams.get("notify") === "1";
  if (!isOpen) return null;

  function dismiss() {
    // Remove the notify param without full reload
    router.replace(`/manager/requests/${requestId}?saved=1`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData(formRef.current!);
    fd.set("request_id", String(requestId));
    fd.set("message", message);
    startTransition(async () => {
      await notifyAction(fd);
      setSent(true);
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.45)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 16,
      }}
      onClick={dismiss}
    >
      <div
        className="card"
        style={{
          width: "min(540px, 100%)",
          padding: 0, overflow: "hidden",
          boxShadow: "0 8px 40px rgba(0,0,0,0.22)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "flex-start",
          justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>
              📱 Notify partners via SMS
            </div>
            <div className="small muted" style={{ marginTop: 2 }}>
              {requestTitle} — {partnerCount} partner{partnerCount !== 1 ? "s" : ""} will receive this message
            </div>
          </div>
          <button
            type="button"
            onClick={dismiss}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: 20, lineHeight: 1, color: "var(--muted)",
              padding: "2px 6px", flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px" }}>
          {sent ? (
            <div style={{
              textAlign: "center", padding: "28px 0",
              color: "#16a34a", fontWeight: 600, fontSize: 15,
            }}>
              ✓ SMS sent to all partners!
            </div>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit}>
              <input type="hidden" name="request_id" value={requestId} />

              <div className="field" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: 13, display: "block", marginBottom: 6 }}>
                  Message
                  <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>
                    (edit before sending)
                  </span>
                </label>
                <textarea
                  name="message"
                  rows={5}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{
                    width: "100%", padding: "8px 12px",
                    border: "1px solid var(--border)", borderRadius: 8,
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 13, lineHeight: 1.5, resize: "vertical",
                    background: "#fff", color: "var(--text)",
                    boxSizing: "border-box",
                  }}
                />
                <p className="small muted" style={{ margin: "5px 0 0" }}>
                  Placeholders like <code>{"{{title}}"}</code> have already been filled in from your settings default template.
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={dismiss}
                  disabled={isPending}
                >
                  Skip
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={isPending || !message.trim()}
                  style={{ background: "var(--indigo)", color: "#fff" }}
                >
                  {isPending ? "Sending…" : `Send SMS to ${partnerCount} partner${partnerCount !== 1 ? "s" : ""}`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
