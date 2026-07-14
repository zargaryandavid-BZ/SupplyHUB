import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseServer";

const COOKIE = "shub_actor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=invalid_token", req.url));
  }

  const { data: partner } = await supabaseAdmin()
    .from("partners")
    .select("id")
    .eq("portal_token", token)
    .single();

  if (!partner) {
    return NextResponse.redirect(new URL("/?error=invalid_token", req.url));
  }

  // Optional deep-link after login (relative path only).
  const nextRaw = req.nextUrl.searchParams.get("next") || "/partner";
  const next =
    nextRaw.startsWith("/partner") && !nextRaw.startsWith("//") ? nextRaw : "/partner";

  const res = NextResponse.redirect(new URL(next, req.url));
  res.cookies.set(COOKIE, `partner:${partner.id}`, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });
  return res;
}
