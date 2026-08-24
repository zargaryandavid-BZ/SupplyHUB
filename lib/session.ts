import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { supabaseAdmin } from "./supabaseServer";
import { partnerById } from "./data";
import type { Partner, Employee } from "./types";

export const SESSION_COOKIE = "shub_session";
const LEGACY_COOKIE = "shub_actor";
const INACTIVITY_MS = 8 * 60 * 60 * 1000; // 8 hours idle timeout (full workday)
const UPDATE_THRESHOLD_MS = 5 * 60 * 1000; // only write DB if >5 min stale

export type Actor =
  | { role: "manager" }
  | { role: "employee"; employeeId: string; employee: Employee }
  | { role: "partner"; partnerId: number; partner: Partner }
  | { role: "guest" };

export async function getActor(): Promise<Actor> {
  const jar = cookies();

  // ── New session system ──────────────────────────────────────────
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    const t0 = Date.now();
    const sb = supabaseAdmin();
    const { data: session } = await sb
      .from("auth_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("verified", true)
      .maybeSingle();
    console.log(`[getActor] auth_sessions query: ${Date.now() - t0}ms`);

    if (session) {
      const lastActive = new Date(session.last_active as string).getTime();
      const now = Date.now();

      if (now - lastActive > INACTIVITY_MS) {
        // Session expired — clean up
        await sb.from("auth_sessions").delete().eq("id", sessionId);
        jar.delete(SESSION_COOKIE);
        return { role: "guest" };
      }

      // Refresh last_active only if stale enough (reduce DB writes)
      if (now - lastActive > UPDATE_THRESHOLD_MS) {
        await sb
          .from("auth_sessions")
          .update({ last_active: new Date().toISOString() })
          .eq("id", sessionId);
      }

      if (session.actor_type === "manager") return { role: "manager" };

      if (session.actor_type === "employee" && session.actor_uuid) {
        const { data: emp } = await sb
          .from("employees")
          .select("*")
          .eq("id", session.actor_uuid)
          .eq("is_active", true)
          .maybeSingle();
        if (emp) return { role: "employee", employeeId: emp.id as string, employee: emp as Employee };
      }

      if (session.actor_type === "partner" && session.actor_id) {
        const partner = await partnerById(session.actor_id as number);
        if (partner) return { role: "partner", partnerId: session.actor_id as number, partner };
      }
    }
  }

  // ── Legacy demo cookie (local dev fallback) ─────────────────────
  const raw = jar.get(LEGACY_COOKIE)?.value;
  if (raw) {
    if (raw === "manager") return { role: "manager" };
    if (raw.startsWith("partner:")) {
      const id = Number(raw.split(":")[1]);
      const partner = await partnerById(id);
      if (partner) return { role: "partner", partnerId: id, partner };
    }
  }

  return { role: "guest" };
}

/** Create a new verified session (used after OTP is confirmed or magic-link). */
export async function createSession(
  actorType: "manager" | "partner" | "employee",
  actorId?: number,
  actorUuid?: string
): Promise<string> {
  const id = randomUUID();
  await supabaseAdmin().from("auth_sessions").insert({
    id,
    actor_type: actorType,
    actor_id: actorId ?? null,
    actor_uuid: actorUuid ?? null,
    verified: true,
    last_active: new Date().toISOString(),
  });
  cookies().set(SESSION_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24h cookie — server-side idle check (8h) is the real enforcer
  });
  return id;
}

/** Create a pending (unverified) OTP session. Returns session ID. */
export async function createPendingSession(
  actorType: "manager" | "partner" | "employee",
  actorId: number | null,
  otpHash: string,
  actorUuid?: string
): Promise<string> {
  const id = randomUUID();
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  await supabaseAdmin().from("auth_sessions").insert({
    id,
    actor_type: actorType,
    actor_id: actorId,
    actor_uuid: actorUuid ?? null,
    otp_hash: otpHash,
    otp_expires: expires,
    verified: false,
    last_active: new Date().toISOString(),
  });
  cookies().set(SESSION_COOKIE, id, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 15, // 15 min for OTP flow
  });
  return id;
}

/** Destroy the current session. */
export async function destroySession(): Promise<void> {
  const jar = cookies();
  const sessionId = jar.get(SESSION_COOKIE)?.value;
  if (sessionId) {
    await supabaseAdmin().from("auth_sessions").delete().eq("id", sessionId);
    jar.delete(SESSION_COOKIE);
  }
  // Also clear legacy cookie
  jar.delete(LEGACY_COOKIE);
}
