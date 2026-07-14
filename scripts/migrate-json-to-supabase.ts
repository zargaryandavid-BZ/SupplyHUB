/**
 * One-time migration script: reads data/db.json and inserts all records into
 * a Supabase Postgres database, preserving original IDs.
 *
 * Usage:
 *   npx tsx scripts/migrate-json-to-supabase.ts
 *
 * Prerequisites:
 *   - .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *   - The database must already have the schema from supabase/migrations/0001_init.sql
 *   - data/db.json must exist (the old JSON store file)
 *
 * The script is idempotent-ish: it skips records whose ID already exists (upsert on conflict).
 * After running, sequences are advanced so future auto-generated IDs don't collide.
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local manually (tsx doesn't auto-load it)
function loadEnv() {
  const envFile = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envFile)) {
    console.error("❌  .env.local not found. Create it from .env.local.example first.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const DB_FILE = path.join(process.cwd(), "data", "db.json");
if (!fs.existsSync(DB_FILE)) {
  console.log("⚠️  data/db.json not found — nothing to migrate. Run the app once to create seed data, or skip this step.");
  process.exit(0);
}

const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));

async function upsert(table: string, rows: Record<string, unknown>[], onConflict: string) {
  if (!rows.length) return;
  const { error } = await sb.from(table).upsert(rows, { onConflict });
  if (error) {
    console.error(`❌  Error upserting into ${table}:`, error.message);
    process.exit(1);
  }
  console.log(`  ✓ ${table}: ${rows.length} rows`);
}

async function advanceSequences() {
  // Call the SQL function that resets all sequences past the current max IDs.
  // If the function doesn't exist yet, fall back to individual calls.
  const { error } = await sb.rpc("update_sequences");
  if (error) {
    console.warn("  ⚠️  update_sequences() RPC not available — sequences not reset.");
    console.warn("     Run this SQL manually to avoid future ID collisions:");
    const tables = ["clients", "partners", "orders", "product_requests", "dispatches", "quotes", "messages"];
    for (const t of tables) {
      console.warn(`     SELECT setval(pg_get_serial_sequence('${t}', 'id'), (SELECT COALESCE(MAX(id), 0) + 1 FROM ${t}), false);`);
    }
  } else {
    console.log("  ✓ sequences advanced");
  }
}

async function main() {
  console.log("🚀  Starting migration from data/db.json → Supabase...\n");

  // Strip the 'meta' field, insert in FK order
  await upsert("clients", db.clients ?? [], "id");
  await upsert("partners", (db.partners ?? []).map((p: Record<string, unknown>) => ({
    ...p,
    // Ensure products is a proper JSON value (not a string)
    products: Array.isArray(p.products) ? p.products : [],
  })), "id");
  await upsert("orders", db.orders ?? [], "id");
  await upsert("product_requests", db.product_requests ?? [], "id");
  await upsert("dispatches", db.dispatches ?? [], "id");
  await upsert("quotes", db.quotes ?? [], "id");
  await upsert("messages", db.messages ?? [], "id");

  await advanceSequences();

  console.log("\n✅  Migration complete. Your data is now in Supabase.");
  console.log("   You can now rename or delete data/db.json — it will no longer be used.\n");
}

main().catch((err) => {
  console.error("❌  Unexpected error:", err);
  process.exit(1);
});
