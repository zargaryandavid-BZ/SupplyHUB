import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { managerRequests } from "@/lib/data";
import { getSettings } from "@/lib/settings";
import { publicLogoUrl } from "@/lib/storage";
import { Sidebar } from "@/components/Sidebar";
import { PrintHouseContactCard } from "@/components/PrintHouseContactCard";
import { ManagerRequestsView } from "@/components/ManagerRequestsView";
import { sendReminder, updateRequestStatus, duplicateRequest, deleteRequest } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ManagerBoard({
  searchParams,
}: {
  searchParams: { reminded?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager" && actor.role !== "employee") redirect("/");

  const ownerFilter = actor.role === "employee" ? actor.employeeId : undefined;
  const [requests, settings] = await Promise.all([
    managerRequests(ownerFilter),
    actor.role === "employee" ? getSettings() : Promise.resolve(null),
  ]);
  const isManager = actor.role === "manager";
  const logoUrl = settings ? publicLogoUrl(settings.logo_path) : null;

  return (
    <div className="app">
      <Sidebar active="board" />
      <main className="main">
        {settings && (
          <PrintHouseContactCard settings={settings} logoUrl={logoUrl} />
        )}

        <div className="page-head">
          <div>
            <h1>Requests</h1>
            <p>Every product request routed to your partners, by stage.</p>
          </div>
        </div>

        {searchParams.reminded && (
          <div className="notice" style={{ marginBottom: 14 }}>
            📩 Reminder sent to {searchParams.reminded} partner{Number(searchParams.reminded) !== 1 ? "s" : ""}.
          </div>
        )}

        <ManagerRequestsView
          requests={requests}
          isManager={isManager}
          actions={{ sendReminder, updateStatus: updateRequestStatus, duplicate: duplicateRequest, deleteReq: deleteRequest }}
        />
      </main>
    </div>
  );
}
