import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";
import { actorUserId, isAdmin } from "@/lib/feedback";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
) {
  const actor = await getActor();
  if (actor.role === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: img } = await sb
    .from("feedback_images")
    .select("storage_path, feedback(user_id)")
    .eq("id", params.imageId)
    .eq("feedback_id", params.id)
    .maybeSingle();

  if (!img) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const feedbackUserId = (img.feedback as { user_id: number } | null)?.user_id;
  const own = feedbackUserId === actorUserId(actor);
  if (!own && !isAdmin(actor)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await sb.storage.from("feedback-images").remove([img.storage_path as string]);
  await sb.from("feedback_images").delete().eq("id", params.imageId);

  return NextResponse.json({ ok: true });
}
