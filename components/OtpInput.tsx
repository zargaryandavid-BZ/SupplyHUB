"use client";

import { useRef, useState, useTransition } from "react";

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  action: (fd: FormData) => Promise<any>;
};

export function OtpInput({ action }: Props) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [isPending, startTransition] = useTransition();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  function handleChange(i: number, value: string) {
    const cleaned = value.replace(/\D/g, "");
    // Autofill or paste delivers the full code into one input
    if (cleaned.length > 1) {
      const next = [...digits];
      cleaned.split("").forEach((ch, idx) => { if (idx < 6) next[idx] = ch; });
      setDigits(next);
      inputs.current[Math.min(cleaned.length, 5)]?.focus();
      if (next.every(Boolean)) submit(next.join(""));
      return;
    }
    const v = cleaned.slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputs.current[i + 1]?.focus();
    if (v && next.every(Boolean)) submit(next.join(""));
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    const next = [...digits];
    pasted.split("").forEach((ch, idx) => { if (idx < 6) next[idx] = ch; });
    setDigits(next);
    if (pasted.length === 6) submit(pasted);
    else inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  function submit(code: string) {
    const fd = new FormData();
    fd.set("code", code);
    startTransition(() => action(fd));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(digits.join(""));
  }

  const boxStyle: React.CSSProperties = {
    width: 48, height: 58, textAlign: "center",
    fontSize: 24, fontWeight: 700, fontFamily: "inherit",
    border: "1.5px solid #d1d5db", borderRadius: 10,
    outline: "none", caretColor: "transparent",
    color: "#0f172a", background: "#fff",
    transition: "border-color .15s",
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 24 }}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={d}
            disabled={isPending}
            autoComplete={i === 0 ? "one-time-code" : "off"}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            onFocus={(e) => (e.currentTarget.style.borderColor = "#6366f1")}
            onBlur={(e) => (e.currentTarget.style.borderColor = d ? "#6366f1" : "#d1d5db")}
            style={{
              ...boxStyle,
              borderColor: d ? "#6366f1" : "#d1d5db",
              opacity: isPending ? 0.5 : 1,
            }}
            autoFocus={i === 0}
          />
        ))}
      </div>

      <button
        type="submit"
        disabled={isPending || digits.some((d) => !d)}
        style={{
          width: "100%", padding: "12px",
          background: digits.every(Boolean)
            ? "linear-gradient(135deg, #6366f1, #4f46e5)"
            : "#e2e8f0",
          color: digits.every(Boolean) ? "#fff" : "#94a3b8",
          border: "none", borderRadius: 10,
          fontSize: 15, fontWeight: 600, cursor: digits.every(Boolean) ? "pointer" : "default",
          fontFamily: "inherit",
          boxShadow: digits.every(Boolean) ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
          transition: "all .2s",
        }}
      >
        {isPending ? "Verifying…" : "Verify code"}
      </button>
    </form>
  );
}
