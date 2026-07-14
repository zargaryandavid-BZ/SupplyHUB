import { getActor } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import { logout } from "@/app/actions";

export async function TopBar() {
  const actor = await getActor();
  if (actor.role === "guest") return null;

  let label: string;
  if (actor.role === "manager") {
    const settings = await getSettings();
    const name = settings.manager_name?.trim() || settings.contact_name?.trim() || "";
    label = name ? `${name} · Distribution Manager` : "Distribution Manager";
  } else {
    label =
      (actor.partner.contact ?? actor.partner.company ?? "Partner").split(" ")[0] +
      " · " +
      actor.partner.company;
  }

  return (
    <div style={{
      position: "fixed", top: 0, right: 0, zIndex: 500,
      display: "flex", alignItems: "center", gap: 12,
      padding: "8px 24px",
      background: "rgba(255,255,255,0.88)",
      backdropFilter: "blur(10px)",
      borderBottom: "1px solid var(--border)",
      borderLeft: "1px solid var(--border)",
      borderBottomLeftRadius: 10,
    }}>
      <div style={{ textAlign: "right", lineHeight: 1.35 }}>
        <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.4px" }}>
          Logged in as
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
          {label}
        </div>
      </div>

      <form action={logout}>
        <button
          type="submit"
          style={{
            padding: "5px 12px",
            border: "1px solid var(--border)",
            borderRadius: 7,
            background: "#fff",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--muted)",
            cursor: "pointer",
            fontFamily: "inherit",
            transition: "border-color .15s, color .15s",
            whiteSpace: "nowrap",
          }}
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
