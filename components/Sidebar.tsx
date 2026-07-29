import Link from "next/link";
import { getActor } from "@/lib/session";
import { partnerRequests } from "@/lib/data";
import { supabaseAdmin } from "@/lib/supabaseServer";

function IconRequests() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/>
      <polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

function IconPartners() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconMyRequests() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M9 11l3 3L22 4"/>
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
}

function IconFeedback() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

const navItemStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 9,
};

export async function Sidebar({ active }: { active: string }) {
  const actor = await getActor();

  // Count awaiting quotes for the current partner
  let awaitingCount = 0;
  if (actor.role === "partner") {
    const reqs = await partnerRequests(actor.partnerId);
    awaitingCount = reqs.filter((r) => !r.quote_status).length;
  }

  // Feedback total count (all roles)
  let feedbackCount = 0;
  if (actor.role !== "guest") {
    const { count } = await supabaseAdmin()
      .from("feedback")
      .select("id", { count: "exact", head: true });
    feedbackCount = count ?? 0;
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
            <Link href="/manager" className={active === "board" ? "active" : ""} style={navItemStyle}>
              <IconRequests /> Requests
            </Link>
            <Link href="/manager/partners" className={active === "partners" ? "active" : ""} style={navItemStyle}>
              <IconPartners /> Partner directory
            </Link>
            <Link href="/manager/settings" className={active === "settings" ? "active" : ""} style={navItemStyle}>
              <IconSettings /> Settings
            </Link>
          </>
        ) : (
          <>
            <Link href="/partner" className={active === "myreq" ? "active" : ""}
              style={{ ...navItemStyle, justifyContent: "space-between" }}>
              <span style={navItemStyle}>
                <IconMyRequests /> My requests
              </span>
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

        {/* Feedback — visible to all authenticated users */}
        <Link
          href="/feedback"
          className={active === "feedback" ? "active" : ""}
          style={{ ...navItemStyle, justifyContent: "space-between" }}
        >
          <span style={navItemStyle}>
            <IconFeedback /> Feedback
          </span>
          {feedbackCount > 0 && (
            <span style={{
              background: "#e5e7eb", color: "#374151",
              borderRadius: 999, fontSize: 11, fontWeight: 700,
              minWidth: 18, height: 18, display: "inline-flex",
              alignItems: "center", justifyContent: "center",
              padding: "0 5px", lineHeight: 1, flexShrink: 0,
            }}>
              {feedbackCount}
            </span>
          )}
        </Link>
      </nav>


    </aside>
  );
}

