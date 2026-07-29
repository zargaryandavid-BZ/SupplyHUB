import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";
import { actorUserId } from "@/lib/feedback";
import { Sidebar } from "@/components/Sidebar";
import { FeedbackPage } from "@/components/FeedbackPage";

export const dynamic = "force-dynamic";

export default async function FeedbackRoute() {
  const actor = await getActor();
  if (actor.role === "guest") redirect("/login");

  return (
    <div className="app">
      <Sidebar active="feedback" />
      <main className="main" style={{ paddingTop: 56 }}>
        <FeedbackPage
          isAdmin={actor.role === "manager"}
          currentUserId={actorUserId(actor)}
        />
      </main>
    </div>
  );
}
