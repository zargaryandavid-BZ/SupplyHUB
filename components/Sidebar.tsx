import Link from "next/link";
import { getActor } from "@/lib/session";
import { allPartners, partnerRequests } from "@/lib/data";
import { setActor } from "@/app/actions";

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

      {/* Partner greeting */}
      {!isManager && actor.role === "partner" && (
        <div style={{
          marginTop: "auto", padding: "12px 0 0",
          borderTop: "1px solid rgba(255,255,255,0.12)",
        }}>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 2 }}>Logged in as</div>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
            Hi, {(actor.partner.contact ?? actor.partner.company ?? "Partner").split(" ")[0]}
          </div>
        </div>
      )}

      <div className="role-box">
        <form action={setActor}>
          <label>Viewing as</label>
          <select
            name="actor"
            className="select-role"
            defaultValue={currentValue}
          >
            <option value="manager">Distribution Manager</option>
            {partners.map((p) => (
              <option key={p.id} value={`partner:${p.id}`}>
                {p.company} (partner)
              </option>
            ))}
          </select>
          <button className="btn sm" style={{ marginTop: 8, width: "100%" }} type="submit">
            Switch
          </button>
        </form>
      </div>
    </aside>
  );
}
