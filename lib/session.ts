import { cookies } from "next/headers";
import { partnerById } from "./data";
import type { Partner } from "./types";

const COOKIE = "shub_actor";

export type Actor =
  | { role: "manager" }
  | { role: "partner"; partnerId: number; partner: Partner }
  | { role: "guest" };

export async function getActor(): Promise<Actor> {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return { role: "guest" };
  if (raw === "manager") return { role: "manager" };
  if (raw.startsWith("partner:")) {
    const id = Number(raw.split(":")[1]);
    const partner = await partnerById(id);
    if (partner) return { role: "partner", partnerId: id, partner };
  }
  return { role: "guest" };
}
