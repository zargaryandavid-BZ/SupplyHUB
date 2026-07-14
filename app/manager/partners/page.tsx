import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { allPartners, partnerStats, partnerActivity } from "@/lib/data";
import { Sidebar } from "@/components/Sidebar";
import { deletePartner, togglePartnerActive } from "@/app/actions";
import { publicLogoUrl } from "@/lib/storage";
import { PartnerDirectoryTable } from "@/components/PartnerDirectoryTable";

export const dynamic = "force-dynamic";

export default async function PartnerDirectory({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const partners = await allPartners();

  const [statsArr, activityArr] = await Promise.all([
    Promise.all(partners.map((p) => partnerStats(p.id))),
    Promise.all(partners.map((p) => partnerActivity(p.id))),
  ]);

  const rows = partners.map((p, i) => ({
    partner: p,
    stats: statsArr[i],
    activity: activityArr[i],
    logoUrl: publicLogoUrl(p.logo_path),
  }));

  return (
    <div className="app">
      <Sidebar active="partners" />
      <main className="main">
        <div className="page-head">
          <div>
            <h1>Partner directory</h1>
            <p>Your supplier network — click a partner to see their activity, or edit their profile.</p>
          </div>
          <Link href="/manager/partners/new" className="btn">
            + Add partner
          </Link>
        </div>

        {searchParams.error === "has_history" && (
          <div className="notice error">
            This partner has quote history and cannot be deleted. Deactivate them instead.
          </div>
        )}

        <PartnerDirectoryTable
          rows={rows}
          deletePartner={deletePartner}
          togglePartnerActive={togglePartnerActive}
        />
      </main>
    </div>
  );
}
