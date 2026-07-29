import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { getActor } from "@/lib/session";
import { actorUserId, TENANT_ID, MAX_IMAGES, MAX_IMAGE_BYTES } from "@/lib/feedback";

export const dynamic = "force-dynamic";

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const actor = await getActor();
  if (actor.role === "guest") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sb = supabaseAdmin();
  const { data: feedback } = await sb
    .from("feedback").select("user_id").eq("id", params.id).maybeSingle();
  if (!feedback) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only the author can upload
  if (feedback.user_id !== actorUserId(actor))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Enforce 5-image limit
  const { count } = await sb
    .from("feedback_images")
    .select("id", { count: "exact", head: true })
    .eq("feedback_id", params.id);
  if ((count ?? 0) >= MAX_IMAGES)
    return NextResponse.json({ error: `Max ${MAX_IMAGES} images` }, { status: 400 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "Images only" }, { status: 400 });
  if (file.size > MAX_IMAGE_BYTES)
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });

  const path = `${TENANT_ID}/${params.id}/${Date.now()}-${safeName(file.name)}`;
  const buffer = await file.arrayBuffer();

  const { error: uploadErr } = await sb.storage
    .from("feedback-images")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadErr) return NextResponse.json({ error: "Upload failed" }, { status: 500 });

  const { data: img } = await sb
    .from("feedback_images")
    .insert({
      tenant_id: TENANT_ID,
      feedback_id: params.id,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      storage_path: path,
      position: count ?? 0,
    })
    .select("*")
    .single();

  const { data: signed } = await sb.storage
    .from("feedback-images").createSignedUrl(path, 48 * 3600);

  return NextResponse.json({
    image: {
      id: img?.id,
      file_name: file.name,
      mime_type: file.type,
      url: signed?.signedUrl ?? null,
    }
  }, { status: 201 });
}
