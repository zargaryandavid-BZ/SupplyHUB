import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/session";
import { allPartners } from "@/lib/data";
import { createPartner } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { PartnerForm } from "@/components/PartnerForm";

export const dynamic = "force-dynamic";

export default async function NewPartner({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");

  const partners = await allPartners();
  const knownProducts = [...new Set(
    partners.flatMap((p) => (p.products ?? []).map((pr) => pr.name.trim())).filter(Boolean)
  )].sort((a, b) => a.localeCompare(b));

  return (
    <div className="app">
      <Sidebar active="partners" />
      <main className="main">
        <div className="page-head">
          <div>
            <h1>Add partner</h1>
            <p>New suppliers are invited by email/SMS and can then quote on requests.</p>
          </div>
          <Link href="/manager/partners" className="btn ghost">
            ← Back
          </Link>
        </div>

        {searchParams.error === "1" && (
          <div className="notice error">Company name is required.</div>
        )}
        {searchParams.error === "logo" && (
          <div className="notice error">
            Logo must be PNG, JPG, WebP, or SVG and under 2 MB.
          </div>
        )}

        <PartnerForm action={createPartner} knownProducts={knownProducts} />
      </main>
    </div>
  );
}
