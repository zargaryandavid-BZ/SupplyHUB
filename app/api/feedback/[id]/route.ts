import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";
import { actorUserId, isAdmin } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: existing } = await sb.from("feedback").select("*").eq("id", params.id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const userId = actorUserId(actor);
  const own = existing.user_id === userId;
  const admin = isAdmin(actor);
  if (!own && !admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

  // Content fields — only by author
  if (own) {
    if (body.type !== undefined) updates.type = String(body.type).trim();
    if (body.page !== undefined) updates.page = String(body.page).trim();
    if (body.title !== undefined) updates.title = String(body.title).trim();
    if (body.comment !== undefined) updates.comment = String(body.comment).trim();
  }

  // Admin-only fields
  if (admin) {
    if (body.status !== undefined) updates.status = String(body.status).trim();
    if (body.admin_note !== undefined) {
      updates.admin_note = String(body.admin_note).trim() || null;
    }
  }

  const { data: row } = await sb
    .from("feedback").update(updates).eq("id", params.id).select("*").single();

  return NextResponse.json({ item: { ...row, is_own: own, images: [] } });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (!isAdmin(actor)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();

  // Remove storage files first
  const { data: imgs } = await sb
    .from("feedback_images").select("storage_path").eq("feedback_id", params.id);
  if (imgs?.length) {
    await sb.storage.from("feedback-images").remove(imgs.map((i) => i.storage_path as string));
  }

  // Delete row (cascades to feedback_images)
  await sb.from("feedback").delete().eq("id", params.id);
  return NextResponse.json({ ok: true });
}
