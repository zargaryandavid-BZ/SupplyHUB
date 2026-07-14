import Link from "next/link";
import { getActor } from "@/lib/session";
import { partnerRequests } from "@/lib/data";

export async function Sidebar({ active }: { active: string }) {
  const actor = await getActor();

  // Count awaiting quotes for the current partner
  let awaitingCount = 0;
  if (actor.role === "partner") {
    const reqs = await partnerRequests(actor.partnerId);
    awaitingCount = reqs.filter((r) => !r.quote_status).length;
  }

  const isManager = actor.role === "manager";

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


    </aside>
  );
}
