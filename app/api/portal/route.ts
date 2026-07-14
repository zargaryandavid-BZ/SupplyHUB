import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { SESSION_COOKIE } from "@/lib/session";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  const { data: partner } = await supabaseAdmin()
    .from("partners")
    .select("id")
    .eq("portal_token", token)
    .single();

  if (!partner) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", req.url));
  }

  // Optional deep-link after login (relative path only).
  const nextRaw = req.nextUrl.searchParams.get("next") || "/partner";
  const next =
    nextRaw.startsWith("/partner") && !nextRaw.startsWith("//") ? nextRaw : "/partner";

  // Create a proper verified session
  const sessionId = randomUUID();
  await supabaseAdmin().from("auth_sessions").insert({
    id: sessionId,
    actor_type: "partner",
    actor_id: partner.id,
    verified: true,
    last_active: new Date().toISOString(),
  });

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(SESSION_COOKIE, sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 2,
  });
  return res;
}
