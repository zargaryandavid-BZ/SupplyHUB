import { NextRequest, NextResponse } from "next/server";
import { getActor } from "@/lib/session";
import { uploadProposalImage, ensureBuckets } from "@/lib/storage";

export const dynamic = "force-dynamic";

// POST /api/proposals/upload-image
// Accepts:
//   multipart/form-data { file: File }          — direct upload
//   application/json    { source_url: string }  — copy from signed URL
export async function POST(req: NextRequest) {
  const actor = await getActor();
  if (actor.role !== "manager") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure the proposal-images bucket exists (public)
  await ensureBuckets();

  const ct = req.headers.get("content-type") ?? "";

  if (ct.includes("multipart/form-data")) {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());
    const url = await uploadProposalImage(buffer, file.type || "image/jpeg", ext);
    return NextResponse.json({ url });
  }

  // JSON body: copy from source URL (signed attachment URL)
  const body = await req.json().catch(() => null);
  const sourceUrl = body?.source_url as string | undefined;
  if (!sourceUrl) return NextResponse.json({ error: "source_url required" }, { status: 400 });

  const res = await fetch(sourceUrl);
  if (!res.ok) return NextResponse.json({ error: "Failed to fetch source image" }, { status: 400 });

  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const ext = mimeType.split("/")[1]?.split(";")[0] ?? "jpg";
  const buffer = Buffer.from(await res.arrayBuffer());
  const url = await uploadProposalImage(buffer, mimeType, ext);
  return NextResponse.json({ url });
}
