import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { partnerRequests } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { publicLogoUrl } from "@/lib/storage";
import { Sidebar } from "@/components/Sidebar";
import { PrintHouseContactCard } from "@/components/PrintHouseContactCard";
import { WonRequestsSection } from "@/components/WonRequestsSection";
import { PartnerRequestsTable } from "@/components/PartnerRequestsTable";

export const dynamic = "force-dynamic";

function bucketOf(r: { quote_status: string | null }) {
  if (r.quote_status === "won") return "Won";
  if (r.quote_status === "lost") return "Not selected";
  if (r.quote_status === "submitted") return "Submitted";
  return "Needs a quote";
}

const BUCKETS = ["Needs a quote", "Submitted", "Won", "Not selected"];

export default async function PartnerHome() {
  const actor = await getActor();
  if (actor.role !== "partner") redirect("/");
  const [requests, settings] = await Promise.all([
    partnerRequests(actor.partnerId),
    getSettings(),
  ]);
  const logoUrl = publicLogoUrl(settings.logo_path);

  return (
    <div className="app">
      <Sidebar active="myreq" />
      <main className="main">
        <PrintHouseContactCard settings={settings} logoUrl={logoUrl} />

        <div className="page-head">
          <div>
            <h1>{actor.partner.company} requests</h1>
            <p>Submit your best price and lead time.</p>
          </div>
        </div>

        {requests.length === 0 && (
          <div className="card">
            <p className="muted">No requests yet. When the print house sends you one, it appears here.</p>
          </div>
        )}

        {/* Won requests — animated special section */}
        <WonRequestsSection
          items={requests.filter((r) => bucketOf(r) === "Won")}
          companyName={settings.company_name ?? actor.partner.company}
          contactName={settings.contact_name}
          contactPhone={settings.contact_phone}
          contactEmail={settings.contact_email}
        />

        {/* All non-won requests with status filter */}
        <PartnerRequestsTable
          items={requests.filter((r) => bucketOf(r) !== "Won")}
        />
      </main>
    </div>
  );
}
