import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { managerRequests } from "@/lib/data";
import { Sidebar } from "@/components/Sidebar";
import { ManagerRequestsView } from "@/components/ManagerRequestsView";

export const dynamic = "force-dynamic";

export default async function ManagerBoard() {
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
          <Link href="/manager/requests/new" className="btn">
            + New request
          </Link>
        </div>

        <ManagerRequestsView requests={requests} />
      </main>
    </div>
  );
}
