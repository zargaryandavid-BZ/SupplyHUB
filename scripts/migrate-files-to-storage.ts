/**
 * One-time migration: move partner logos and request attachments that were
 * written to public/uploads/ (local filesystem) into Supabase Storage.
 *
 * Usage:
 *   npx tsx scripts/migrate-files-to-storage.ts
 *
 * After a successful run, new uploads go straight to Storage and
 * public/uploads/ no longer receives writes.  You may delete the directory
 * contents (keep a .gitkeep so git doesn't drop the folder) once you've
 * verified the migration in production.
 *
 * The script is idempotent: rows whose logo_path / attachments already point
 * at Storage keys (not /uploads/…) are skipped automatically.
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { ensureBuckets } from "../lib/storage";

// ── Supabase client (service-role, bypasses RLS) ─────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Export them before running, or load .env.local:\n" +
      "  export $(grep -v '^#' .env.local | xargs) && npx tsx scripts/migrate-files-to-storage.ts"
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const LOGOS_BUCKET = "partner-logos";
const ATTACHMENTS_BUCKET = "request-attachments";
const PUBLIC_DIR = path.join(process.cwd(), "public");

function isLegacyPath(value: string): boolean {
  return value.startsWith("/uploads/");
}

function mimeFromExt(ext: string): string {
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    svg: "image/svg+xml",
    pdf: "application/pdf",
  };
  return map[ext.toLowerCase()] ?? "application/octet-stream";
}

// ── Logos ────────────────────────────────────────────────────────────────────

async function migrateLogos(): Promise<void> {
  const { data: partners, error } = await sb
    .from("partners")
    .select("id, company, logo_path")
    .not("logo_path", "is", null);

  if (error) throw new Error(`Failed to fetch partners: ${error.message}`);

  let migrated = 0;
  let skipped = 0;

  for (const p of partners ?? []) {
    const oldPath: string = p.logo_path;
    if (!isLegacyPath(oldPath)) {
      skipped++;
      continue;
    }

    const localFile = path.join(PUBLIC_DIR, oldPath);
    if (!fs.existsSync(localFile)) {
      console.warn(`  [logo] File not found, skipping partner ${p.id} (${p.company}): ${localFile}`);
      skipped++;
      continue;
    }

    const ext = localFile.split(".").pop() ?? "bin";
    const key = `partner-${p.id}/${Date.now()}.${ext}`;
    const buf = fs.readFileSync(localFile);

    const { error: upErr } = await sb.storage
      .from(LOGOS_BUCKET)
      .upload(key, buf, { contentType: mimeFromExt(ext), upsert: true });

    if (upErr) {
      console.error(`  [logo] Upload failed for partner ${p.id}: ${upErr.message}`);
      continue;
    }

    const { error: updErr } = await sb
      .from("partners")
      .update({ logo_path: key })
      .eq("id", p.id);

    if (updErr) {
      console.error(`  [logo] DB update failed for partner ${p.id}: ${updErr.message}`);
      continue;
    }

    console.log(`  [logo] ✓ partner ${p.id} (${p.company})  ${oldPath}  →  ${key}`);
    migrated++;
  }

  console.log(`Logos: ${migrated} migrated, ${skipped} skipped.\n`);
}

// ── Attachments ──────────────────────────────────────────────────────────────

async function migrateAttachments(): Promise<void> {
  const { data: requests, error } = await sb
    .from("product_requests")
    .select("id, title, attachments")
    .not("attachments", "is", null);

  if (error) throw new Error(`Failed to fetch product_requests: ${error.message}`);

  let migrated = 0;
  let skipped = 0;

  for (const req of requests ?? []) {
    let keys: string[];
    try {
      keys = JSON.parse(req.attachments as string);
    } catch {
      console.warn(`  [attach] Skipping request ${req.id}: malformed attachments JSON`);
      skipped++;
      continue;
    }

    const anyLegacy = keys.some(isLegacyPath);
    if (!anyLegacy) {
      skipped++;
      continue;
    }

    const newKeys: string[] = [];
    for (const oldKey of keys) {
      if (!isLegacyPath(oldKey)) {
        newKeys.push(oldKey); // already a storage key
        continue;
      }

      const localFile = path.join(PUBLIC_DIR, oldKey);
      if (!fs.existsSync(localFile)) {
        console.warn(`  [attach] File not found, dropping key for request ${req.id}: ${localFile}`);
        continue;
      }

      const ext = localFile.split(".").pop() ?? "bin";
      const storageKey = `req-${req.id}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${ext}`;
      const buf = fs.readFileSync(localFile);

      const { error: upErr } = await sb.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storageKey, buf, {
          contentType: mimeFromExt(ext),
          upsert: true,
        });

      if (upErr) {
        console.error(
          `  [attach] Upload failed for request ${req.id} (${oldKey}): ${upErr.message}`
        );
        continue;
      }

      console.log(`  [attach] ✓ request ${req.id}  ${oldKey}  →  ${storageKey}`);
      newKeys.push(storageKey);
      migrated++;
    }

    const { error: updErr } = await sb
      .from("product_requests")
      .update({ attachments: JSON.stringify(newKeys) })
      .eq("id", req.id);

    if (updErr) {
      console.error(`  [attach] DB update failed for request ${req.id}: ${updErr.message}`);
    }
  }

  console.log(`Attachments: ${migrated} migrated, ${skipped} skipped.\n`);
}

// ── Entry point ──────────────────────────────────────────────────────────────

(async () => {
  console.log("SupplyHUB — Migrate files to Supabase Storage\n");

  console.log("Ensuring storage buckets exist…");
  await ensureBuckets();
  console.log("Buckets OK.\n");

  console.log("Migrating partner logos…");
  await migrateLogos();

  console.log("Migrating request attachments…");
  await migrateAttachments();

  console.log(
    "Done.\n\n" +
      "After verifying everything looks correct in the Supabase Storage dashboard,\n" +
      "you can remove public/uploads/* (keep a .gitkeep):\n" +
      "  find public/uploads -type f -not -name .gitkeep -delete"
  );
})();
