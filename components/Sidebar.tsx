import Link from "next/link";
import { getActor } from "@/lib/session";
import { allPartners, partnerRequests } from "@/lib/data";
import { setActor, logout } from "@/app/actions";

export async function Sidebar({ active }: { active: string }) {
  const actor = await getActor();
  const partners = await allPartners();

  // Count awaiting quotes for the current partner
  let awaitingCount = 0;
  if (actor.role === "partner") {
    const reqs = await partnerRequests(actor.partnerId);
    awaitingCount = reqs.filter((r) => !r.quote_status).length;
  }

  const isManager = actor.role === "manager";
  const currentValue =
    actor.role === "manager"
      ? "manager"
      : actor.role === "partner"
      ? `partner:${actor.partnerId}`
      : "";

  return (
    <aside className="sidebar">
      <Link
        href={isManager ? "/manager" : "/partner"}
        className="logo"
        style={{ textDecoration: "none", display: "block" }}
      >
        Supplyer<span>HUB</span>
      </Link>
      <div className="tag">Partner management</div>

      <nav>
        {isManager ? (
          <>
            <Link href="/manager" className={active === "board" ? "active" : ""}>
              Requests
            </Link>
            <Link
              href="/manager/partners"
              className={active === "partners" ? "active" : ""}
            >
              Partner directory
            </Link>
            <Link
              href="/manager/settings"
              className={active === "settings" ? "active" : ""}
            >
              Settings
            </Link>
          </>
        ) : (
          <>
            <Link href="/partner" className={active === "myreq" ? "active" : ""}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              My requests
              {awaitingCount > 0 && (
                <span style={{
                  background: "#dc2626", color: "#fff",
                  borderRadius: 999, fontSize: 11, fontWeight: 700,
                  minWidth: 18, height: 18, display: "inline-flex",
                  alignItems: "center", justifyContent: "center",
                  padding: "0 5px", lineHeight: 1, flexShrink: 0,
                }}>
                  {awaitingCount}
                </span>
              )}
            </Link>
          </>
        )}
      </nav>

      {/* User info + logout */}
      <div style={{
        marginTop: "auto", padding: "12px 0 0",
        borderTop: "1px solid rgba(255,255,255,0.12)",
      }}>
        {actor.role === "partner" && (
          <>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.4px" }}>Logged in as</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              {(actor.partner.contact ?? actor.partner.company ?? "Partner").split(" ")[0]}
              <span style={{ fontWeight: 400, opacity: 0.65 }}> · {actor.partner.company}</span>
            </div>
          </>
        )}
        {actor.role === "manager" && (
          <>
            <div style={{ fontSize: 11, opacity: 0.55, marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.4px" }}>Logged in as</div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Distribution Manager</div>
          </>
        )}
        <form action={logout}>
          <button
            type="submit"
            style={{
              width: "100%", padding: "7px 0", border: "1px solid rgba(255,255,255,0.18)",
              borderRadius: 7, background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.8)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              transition: "background .15s",
            }}
          >
            Sign out
          </button>
        </form>
      </div>

      {/* Dev-only role switcher (hidden in production) */}
      {process.env.NODE_ENV !== "production" && (
        <div className="role-box" style={{ marginTop: 10 }}>
          <form action={setActor}>
            <label style={{ fontSize: 10, opacity: 0.5 }}>DEV: switch role</label>
            <select name="actor" className="select-role" defaultValue={currentValue}>
              <option value="manager">Distribution Manager</option>
              {partners.map((p) => (
                <option key={p.id} value={`partner:${p.id}`}>{p.company} (partner)</option>
              ))}
            </select>
            <button className="btn sm" style={{ marginTop: 6, width: "100%" }} type="submit">Switch</button>
          </form>
        </div>
      )}
    </aside>
  );
}
