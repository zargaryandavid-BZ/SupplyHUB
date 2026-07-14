import { redirect } from "next/navigation";
import { getActor } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const actor = await getActor();
  if (actor.role === "manager") redirect("/manager");
  if (actor.role === "partner") redirect("/partner");
  redirect("/login");
}
