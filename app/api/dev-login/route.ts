import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

// Local dev only — sets the legacy manager cookie instantly, no Supabase needed
export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not available" }, { status: 403 });
  }
  const jar = cookies();
  // Clear any stale session cookies that cause slow Supabase lookups
  jar.delete("shub_session");
  jar.set("shub_actor", "manager", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
  });
  const origin = req.nextUrl.origin;
  return NextResponse.redirect(`${origin}/manager`);
}
