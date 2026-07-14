import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { managerRequests } from "@/lib/data";
import { Sidebar } from "@/components/Sidebar";
import { ManagerRequestsView } from "@/components/ManagerRequestsView";
import { sendReminder, updateRequestStatus, duplicateRequest, deleteRequest } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function ManagerBoard({
  searchParams,
}: {
  searchParams: { reminded?: string };
}) {
  const actor = await getActor();
  if (actor.role !== "manager") redirect("/");
  const requests = await managerRequests();

  return (
    <div className="app">
      <Sidebar active="board" />
      <main className="main">
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
          actions={{ sendReminder, updateStatus: updateRequestStatus, duplicate: duplicateRequest, deleteReq: deleteRequest }}
        />
      </main>
    </div>
  );
}
