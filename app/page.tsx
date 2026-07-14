import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { allPartners } from "@/lib/data";
import { setActor } from "./actions";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actor = await getActor();
  if (actor.role === "manager") redirect("/manager");
  if (actor.role === "partner") redirect("/partner");

  const partners = await allPartners();

  return (
    <div className="landing">
      <div className="logo">
        Supplyer<span>HUB</span>
      </div>
      <p className="muted">Print House Partner &amp; Supplier Management</p>

      {searchParams.error === "invalid_token" && (
        <div className="notice error" style={{ marginBottom: 16, maxWidth: 400 }}>
          This portal link is invalid or has expired. Please contact your print house for a new link.
        </div>
      )}

      <div className="card">
        <h3>Choose how to sign in</h3>
        <p className="small muted">
          This local demo uses a simple role switcher instead of passwords. Pick a
          view to start — you can switch anytime from the sidebar.
        </p>
        <form action={setActor}>
          <div className="field">
            <label>Enter as</label>
            <select name="actor" defaultValue="manager">
              <option value="manager">Distribution Manager (internal)</option>
              {partners.map((p) => (
                <option key={p.id} value={`partner:${p.id}`}>
                  {p.company} — partner portal
                </option>
              ))}
            </select>
          </div>
          <button className="btn" type="submit">
            Enter
          </button>
        </form>
      </div>
    </div>
  );
}
