import "server-only";
import { supabaseAdmin } from "./supabaseServer";

// Bucket names
const LOGOS_BUCKET = "partner-logos";
const ATTACHMENTS_BUCKET = "request-attachments";
const PRODUCT_IMAGES_BUCKET = "partner-products";

// ── Validation constants (logos only) ──────────────────────────────────────
export const LOGO_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];
export const LOGO_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

// ── Validation constants (product images) ──────────────────────────────────
export const PRODUCT_IMAGE_ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

// ── Internal helpers ────────────────────────────────────────────────────────

function logoExt(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/svg+xml": "svg",
  };
  return map[mimeType] ?? mimeType.split("/")[1];
}

/**
 * Returns true for values that are already fully-resolved URLs or legacy
 * local paths (written to public/uploads before this ticket).
 * These are returned as-is by the resolver functions.
 */
function isLegacyOrAbsolute(value: string): boolean {
  return value.startsWith("/uploads/") || value.startsWith("http");
}

// ── Logo helpers ────────────────────────────────────────────────────────────

/**
 * Uploads a logo file to the partner-logos bucket.
 * Object key:  partner-<id>/<timestamp>.<ext>
 * Validation (type + size) must be done by the caller before invoking this.
 * If oldKey is a storage key (not a legacy path), the previous object is
 * removed first so the bucket doesn't accumulate orphaned files.
 *
 * Returns the new object key (stored in partners.logo_path).
 */
export async function uploadLogo(
  file: File,
  partnerId: number,
  oldKey?: string | null
): Promise<string> {
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Logo type not allowed: ${file.type}`);
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("Logo exceeds 2 MB limit");
  }

  if (oldKey && !isLegacyOrAbsolute(oldKey)) {
    await removeLogo(oldKey);
  }

  const ext = logoExt(file.type);
  const key = `partner-${partnerId}/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from(LOGOS_BUCKET)
    .upload(key, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(`uploadLogo failed: ${error.message}`);
  return key;
}

/**
 * Resolves a stored logo_path value to a public URL (synchronous).
 * - null / empty → null
 * - legacy /uploads/… or full http URL → returned as-is
 * - storage object key → Supabase public URL
 */
export function publicLogoUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (isLegacyOrAbsolute(key)) return key;
  const { data } = supabaseAdmin().storage.from(LOGOS_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

/** Removes an object from the partner-logos bucket. Silently ignores missing objects. */
export async function removeLogo(key: string): Promise<void> {
  await supabaseAdmin().storage.from(LOGOS_BUCKET).remove([key]);
}

/**
 * Uploads the company (agency) logo to the partner-logos bucket.
 * Object key:  company/<timestamp>.<ext>
 * If oldKey is provided and is a storage key, it is removed first.
 */
export async function uploadCompanyLogo(
  file: File,
  oldKey?: string | null
): Promise<string> {
  if (!LOGO_ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Logo type not allowed: ${file.type}`);
  }
  if (file.size > LOGO_MAX_BYTES) {
    throw new Error("Logo exceeds 2 MB limit");
  }

  if (oldKey && !isLegacyOrAbsolute(oldKey)) {
    await supabaseAdmin().storage.from(LOGOS_BUCKET).remove([oldKey]);
  }

  const ext = logoExt(file.type);
  const key = `company/${Date.now()}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from(LOGOS_BUCKET)
    .upload(key, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: true,
    });
  if (error) throw new Error(`uploadCompanyLogo failed: ${error.message}`);
  return key;
}

// ── Product image helpers ───────────────────────────────────────────────────

/**
 * Uploads a product image to the partner-products bucket.
 * Object key: partner-<id>/<timestamp>-<rand>.<ext>
 * Validation (type + size) must be done by the caller before invoking this.
 * Returns the new object key (stored in partners.products[].images).
 */
export async function uploadProductImage(file: File, partnerId: number): Promise<string> {
  if (!PRODUCT_IMAGE_ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Product image type not allowed: ${file.type}`);
  }
  if (file.size > PRODUCT_IMAGE_MAX_BYTES) {
    throw new Error("Product image exceeds 5 MB limit");
  }

  const ext = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `partner-${partnerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from(PRODUCT_IMAGES_BUCKET)
    .upload(key, await file.arrayBuffer(), {
      contentType: file.type,
      upsert: false,
    });
  if (error) throw new Error(`uploadProductImage failed: ${error.message}`);
  return key;
}

/** Resolves a stored product image key to a public URL (synchronous). Mirrors publicLogoUrl. */
export function publicProductImageUrl(key: string | null | undefined): string | null {
  if (!key) return null;
  if (isLegacyOrAbsolute(key)) return key;
  const { data } = supabaseAdmin().storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}

/** Removes an object from the partner-products bucket. Silently ignores missing objects. */
export async function removeProductImage(key: string): Promise<void> {
  if (isLegacyOrAbsolute(key)) return;
  await supabaseAdmin().storage.from(PRODUCT_IMAGES_BUCKET).remove([key]);
}

// ── Attachment helpers ──────────────────────────────────────────────────────

/**
 * Uploads an attachment file to the request-attachments bucket.
 * Object key:  req-<id>/<timestamp>-<rand>.<ext>
 * Returns the object key (stored as JSON array in product_requests.attachments).
 */
export async function uploadAttachment(
  file: File,
  requestId: number
): Promise<string> {
  const ext = (file.name.split(".").pop() || "bin").toLowerCase();
  const key = `req-${requestId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(key, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (error) throw new Error(`uploadAttachment failed: ${error.message}`);
  return key;
}

/**
 * Returns a short-lived signed URL for a private attachment.
 * - Legacy /uploads/… paths are returned as-is (Next.js serves them from public/).
 * - Storage keys → Supabase signed URL (default 1 hour).
 */
export async function signedAttachmentUrl(
  key: string,
  expiresInSec = 3600
): Promise<string> {
  if (isLegacyOrAbsolute(key)) return key;
  const { data, error } = await supabaseAdmin()
    .storage.from(ATTACHMENTS_BUCKET)
    .createSignedUrl(key, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(`signedAttachmentUrl failed: ${error?.message ?? "no signed URL returned"}`);
  }
  return data.signedUrl;
}

/** Removes an attachment object. Silently ignores missing / legacy paths. */
export async function removeAttachment(key: string): Promise<void> {
  if (isLegacyOrAbsolute(key)) return;
  await supabaseAdmin().storage.from(ATTACHMENTS_BUCKET).remove([key]);
}

/**
 * Idempotently ensures both storage buckets exist.
 * Called by the setup script and can be called at app boot.
 * Safe to call multiple times — existing buckets are left untouched.
 */
export async function ensureBuckets(): Promise<void> {
  const sb = supabaseAdmin().storage;
  const { data: existing } = await sb.listBuckets();
  const names = new Set((existing ?? []).map((b) => b.name));

  if (!names.has(LOGOS_BUCKET)) {
    const { error } = await sb.createBucket(LOGOS_BUCKET, { public: true });
    if (error && !error.message.includes("already exists")) {
      throw new Error(`Failed to create bucket ${LOGOS_BUCKET}: ${error.message}`);
    }
  }
  if (!names.has(ATTACHMENTS_BUCKET)) {
    const { error } = await sb.createBucket(ATTACHMENTS_BUCKET, { public: false });
    if (error && !error.message.includes("already exists")) {
      throw new Error(`Failed to create bucket ${ATTACHMENTS_BUCKET}: ${error.message}`);
    }
  }
  if (!names.has(PRODUCT_IMAGES_BUCKET)) {
    const { error } = await sb.createBucket(PRODUCT_IMAGES_BUCKET, { public: true });
    if (error && !error.message.includes("already exists")) {
      throw new Error(`Failed to create bucket ${PRODUCT_IMAGES_BUCKET}: ${error.message}`);
    }
  }
}
