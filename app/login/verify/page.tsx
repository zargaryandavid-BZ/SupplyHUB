import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { verifyOtp } from "@/app/actions";
import { OtpInput } from "@/components/OtpInput";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "Please enter the full 6-digit code.",
  wrong: "Incorrect code. Please try again.",
  expired: "The code has expired. Please request a new one.",
};

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: { to?: string; error?: string };
}) {
  const actor = await getActor();
  if (actor.role === "manager") redirect("/manager");
  if (actor.role === "partner") redirect("/partner");

  const errorMsg = searchParams.error
    ? (ERRORS[searchParams.error] ?? "Something went wrong. Try again.")
    : null;

  const sentTo = searchParams.to || "your phone";

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)",
      padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: "#1e293b",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}>
            Supplyer<span style={{ color: "#6366f1" }}>HUB</span>
          </div>
        </div>

        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          padding: "32px 28px",
          textAlign: "center",
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "linear-gradient(135deg,#ede9fe,#ddd6fe)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px", fontSize: 26,
          }}>
            📱
          </div>

          <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            Check your phone
          </h2>
          <p style={{ margin: "0 0 28px", color: "#64748b", fontSize: 14 }}>
            We sent a 6-digit code to <strong>{sentTo}</strong>.<br />
            Enter it below to sign in.
          </p>

          {errorMsg && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, padding: "10px 14px", marginBottom: 18,
              fontSize: 13, color: "#dc2626", textAlign: "left",
            }}>
              {errorMsg}
            </div>
          )}

          <OtpInput action={verifyOtp} />

          <a
            href="/login"
            style={{
              display: "block", marginTop: 20, fontSize: 13,
              color: "#6366f1", textDecoration: "none", fontWeight: 500,
            }}
          >
            ← Use a different number
          </a>
        </div>
      </div>
    </div>
  );
}
