import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";
import { actorUserId, actorDisplayName, TENANT_ID } from "@/lib/feedback";

export const dynamic = "force-dynamic";

async function attachSignedImages(rows: Record<string, unknown>[]) {
  if (!rows.length) return {};
  const sb = supabaseAdmin();
  const ids = rows.map((r) => r.id as string);

  const { data: imgs } = await sb
    .from("feedback_images")
    .select("*")
    .in("feedback_id", ids)
    .order("position")
    .order("created_at");

  const map: Record<string, { id: string; file_name: string; mime_type: string; url: string | null }[]> = {};
  for (const img of imgs ?? []) {
    const { data: signed } = await sb.storage
      .from("feedback-images")
      .createSignedUrl(img.storage_path as string, 48 * 3600);
    if (!map[img.feedback_id as string]) map[img.feedback_id as string] = [];
    map[img.feedback_id as string].push({
      id: img.id as string,
      file_name: img.file_name as string,
      mime_type: img.mime_type as string,
      url: signed?.signedUrl ?? null,
    });
  }
  return map;
}

export async function GET() {
  const actor = await getActor();
  if (actor.role === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: rows } = await supabaseAdmin()
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false });

  const userId = actorUserId(actor);
  const imgMap = await attachSignedImages((rows ?? []) as Record<string, unknown>[]);

  const items = (rows ?? []).map((r) => ({
    ...r,
    is_own: r.user_id === userId,
    images: imgMap[r.id as string] ?? [],
  }));

  return NextResponse.json({ items });
}

export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (actor.role === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const type = String(body.type ?? "").trim();
  const page = String(body.page ?? "").trim();
  const title = String(body.title ?? "").trim();
  const comment = String(body.comment ?? "").trim();

  if (!["bug", "feature_request", "question", "other"].includes(type))
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  if (!page) return NextResponse.json({ error: "page required" }, { status: 400 });
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  if (!comment) return NextResponse.json({ error: "comment required" }, { status: 400 });

  const { data: row, error } = await supabaseAdmin()
    .from("feedback")
    .insert({
      tenant_id: TENANT_ID,
      user_id: actorUserId(actor),
      display_name: actorDisplayName(actor),
      type, page, title, comment, status: "open",
    })
    .select("*")
    .single();

  if (error || !row) return NextResponse.json({ error: "Failed to create" }, { status: 500 });
  return NextResponse.json({ item: { ...row, is_own: true, images: [] } }, { status: 201 });
}
