import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { requestOtp } from "@/app/actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  required: "Please enter your phone number or email.",
  not_found: "No account found for that phone or email. Contact your administrator.",
  no_phone: "No phone number on file for that account. Contact your administrator.",
  expired: "Your session expired. Please log in again.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actor = await getActor();
  if (actor.role === "manager") redirect("/manager");
  if (actor.role === "partner") redirect("/partner");

  const errorMsg = searchParams.error ? (ERRORS[searchParams.error] ?? "Something went wrong. Try again.") : null;

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f0f4ff 0%, #fafafa 60%, #f5f0ff 100%)",
      padding: 16,
    }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/bazaar-logo.png"
            alt="Bazaar Printing"
            style={{ width: 72, height: 72, objectFit: "contain", marginBottom: 12, borderRadius: 12 }}
          />
          <div style={{
            fontSize: 26, fontWeight: 800, letterSpacing: "-0.5px", color: "#1e293b",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          }}>
            Supplyer<span style={{ color: "var(--indigo, #6366f1)" }}>HUB</span>
          </div>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 6 }}>
            Print House Partner &amp; Supplier Management Platform by Bazaar Printing
          </p>
        </div>

        <div style={{
          background: "#fff", borderRadius: 16,
          border: "1px solid #e2e8f0",
          boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
          padding: "32px 28px",
        }}>
          <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 700, color: "#0f172a" }}>
            Sign in
          </h2>
          <p style={{ margin: "0 0 24px", color: "#64748b", fontSize: 14 }}>
            We&rsquo;ll text you a verification code.
          </p>

          {errorMsg && (
            <div style={{
              background: "#fef2f2", border: "1px solid #fecaca",
              borderRadius: 8, padding: "10px 14px", marginBottom: 18,
              fontSize: 13, color: "#dc2626",
            }}>
              {errorMsg}
            </div>
          )}

          <form action={requestOtp}>
            <div style={{ marginBottom: 18 }}>
              <label style={{
                display: "block", fontSize: 13, fontWeight: 600,
                color: "#374151", marginBottom: 6,
              }}>
                Phone number or email
              </label>
              <input
                name="identifier"
                type="text"
                autoFocus
                autoComplete="tel email"
                placeholder="+1 310 555 0100 or you@company.com"
                required
                className="otp-id-input"
              />
            </div>

            <button
              type="submit"
              style={{
                width: "100%", padding: "12px",
                background: "linear-gradient(135deg, #6366f1, #4f46e5)",
                color: "#fff", border: "none", borderRadius: 10,
                fontSize: 15, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                transition: "opacity .15s",
              }}
            >
              Send code →
            </button>
          </form>

          <p style={{ marginTop: 20, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
            You&rsquo;ll receive a 6-digit code via SMS. Standard rates may apply.
          </p>
        </div>
      </div>
    </div>
  );
}
