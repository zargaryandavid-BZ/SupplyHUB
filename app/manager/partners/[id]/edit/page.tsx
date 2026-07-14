import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/session";
import { partnerById, partnerStats, allPartners } from "@/lib/data";
import { updatePartner, deletePartner, togglePartnerActive, generatePortalToken } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { PartnerForm } from "@/components/PartnerForm";
import { publicLogoUrl, publicProductImageUrl } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function EditPartner({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string; saved?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const [partner, stats, allPartnersData] = await Promise.all([
    partnerById(Number(params.id)),
    partnerStats(Number(params.id)),
    allPartners(),
  ]);
  if (!partner) redirect("/manager/partners");

  const isActive = partner.active === 1;
  const productImageUrls = (partner.products ?? []).map((p) =>
    (p.images ?? []).map((key) => publicProductImageUrl(key))
  );

  // Collect unique product names from all OTHER partners for autocomplete
  const knownProducts = [...new Set(
    allPartnersData
      .filter((p) => p.id !== partner.id)
      .flatMap((p) => (p.products ?? []).map((pr) => pr.name.trim()))
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  return (
    <div className="app">
      <Sidebar active="partners" />
      <main className="main" style={{ paddingTop: 20, paddingBottom: 20 }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 4, fontSize: 13, color: "var(--muted)" }}>
          <Link href="/manager/partners" style={{ color: "var(--muted)" }}>
            Partners
          </Link>
          <span style={{ margin: "0 6px", opacity: 0.5 }}>/</span>
          <span>{partner.company}</span>
        </div>

        {/* Page heading */}
        <div className="page-head" style={{ marginBottom: 14, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>Edit partner</h1>
            <span className={`badge ${isActive ? "awarded" : "inactive"}`}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {searchParams.saved === "1" && (
          <div className="notice">Partner saved successfully.</div>
        )}
        {searchParams.error === "1" && (
          <div className="notice error">Company name is required.</div>
        )}
        {searchParams.error === "logo" && (
          <div className="notice error">
            Logo must be PNG, JPG, WebP, or SVG and under 2 MB.
          </div>
        )}
        {searchParams.error === "save" && (
          <div className="notice error">
            Could not save partner changes. Check the fields and try again.
          </div>
        )}
        {searchParams.error === "has_history" && (
          <div className="notice error">
            This partner has quote history and cannot be deleted. Deactivate them instead to hide
            them from future requests while keeping all historical data intact.
          </div>
        )}

        <PartnerForm
          action={updatePartner}
          partner={partner}
          logoUrl={publicLogoUrl(partner.logo_path)}
          productImageUrls={productImageUrls}
          knownProducts={knownProducts}
          justSaved={searchParams.saved === "1"}
          generatePortalToken={generatePortalToken}
        />

        {/* ── Danger zone ── */}
        <div className="danger-zone" style={{ marginTop: 16 }}>
          <h4 style={{ margin: "0 0 4px" }}>Danger zone</h4>
          <p className="small muted" style={{ margin: "0 0 14px" }}>
            Actions here affect this partner&apos;s visibility and data. Proceed carefully.
          </p>

          {/* Deactivate / Reactivate — reversible */}
          <div style={{ marginBottom: stats.sent === 0 ? 14 : 0 }}>
            <p className="small" style={{ margin: "0 0 6px", fontWeight: 600 }}>
              {isActive ? "Deactivate partner" : "Reactivate partner"}
            </p>
            <p className="small muted" style={{ margin: "0 0 8px" }}>
              {isActive
                ? "Hides this partner from new requests. All historical data is preserved and this can be undone."
                : "Makes this partner available for new requests again."}
            </p>
            {isActive ? (
              <form action={togglePartnerActive}>
                <input type="hidden" name="id" value={partner.id} />
                <input type="hidden" name="active" value="0" />
                <button className="btn sm ghost" type="submit">
                  Deactivate
                </button>
              </form>
            ) : (
              <form action={togglePartnerActive}>
                <input type="hidden" name="id" value={partner.id} />
                <input type="hidden" name="active" value="1" />
                <button className="btn sm green" type="submit">
                  Reactivate
                </button>
              </form>
            )}
          </div>

          {/* Permanent delete — only shown when no history */}
          {stats.sent === 0 ? (
            <>
              <hr style={{ border: "none", borderTop: "1px solid #fecaca", margin: "14px 0" }} />
              <p className="small" style={{ margin: "0 0 6px", fontWeight: 600, color: "var(--red)" }}>
                Permanently delete partner
              </p>
              <p className="small muted" style={{ margin: "0 0 8px" }}>
                This partner has no history and can be permanently removed. This cannot be undone.
              </p>
              <details>
                <summary
                  className="btn sm danger"
                  style={{ cursor: "pointer", listStyle: "none", display: "inline-block" }}
                >
                  Delete partner…
                </summary>
                <div
                  className="card"
                  style={{ marginTop: 10, padding: "14px 16px", borderColor: "#fecaca", background: "#fff5f5" }}
                >
                  <p className="small" style={{ margin: "0 0 10px" }}>
                    <strong>Are you sure?</strong> This permanently removes the partner and cannot
                    be undone.
                  </p>
                  <form action={deletePartner}>
                    <input type="hidden" name="id" value={partner.id} />
                    <button className="btn sm danger" type="submit">
                      Yes, permanently delete
                    </button>
                  </form>
                </div>
              </details>
            </>
          ) : (
            <p className="small muted" style={{ marginTop: 10 }}>
              This partner has {stats.sent} dispatch{stats.sent !== 1 ? "es" : ""} on record and
              cannot be permanently deleted — deactivate them instead.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
