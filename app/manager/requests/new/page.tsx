import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { activePartners } from "@/lib/data";
import { createRequest } from "@/app/actions";
import { Sidebar } from "@/components/Sidebar";
import { NewRequestForm } from "@/components/NewRequestForm";

export const dynamic = "force-dynamic";

export default async function NewRequest({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const partners = await activePartners();

  const partnerOptions = partners.map((p) => ({
    id: p.id,
    company: p.company,
    categories: p.categories,
    products: (p.products ?? []).map((pr) => ({
      name: pr.name,
      moq: pr.moq,
      delivery_days: pr.delivery_days,
      price: pr.price,
      currency: pr.currency,
    })),
  }));

  const seen = new Set<string>();
  const allProducts: string[] = [];
  for (const p of partnerOptions) {
    for (const pr of p.products) {
      const key = pr.name.trim().toLowerCase();
      if (pr.name.trim() && !seen.has(key)) {
        seen.add(key);
        allProducts.push(pr.name.trim());
      }
    }
  }
  allProducts.sort((a, b) => a.localeCompare(b));

  return (
    <div className="app">
      <Sidebar active="new" />
      <main className="main" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <div className="page-head" style={{ marginBottom: 10 }}>
          <div>
            <h1 style={{ fontSize: 22 }}>New request</h1>
            <p>Create a request and send it to matching partners for quotes.</p>
          </div>
        </div>

        {searchParams.error && (
          <div className="notice error" style={{ marginBottom: 12 }}>
            Please fill in at least a request title.
          </div>
        )}

        <NewRequestForm
          partners={partnerOptions}
          products={allProducts}
          createRequest={createRequest}
        />
      </main>
    </div>
  );
}
