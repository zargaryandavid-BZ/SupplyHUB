import { createClient } from "@supabase/supabase-js";

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars. Set them before running.");

  const sb = createClient(url, key);

  const tables = [
    "partner_feedback",
    "messages",
    "quotes",
    "dispatches",
    "product_requests",
    "partners",
  ] as const;

  for (const table of tables) {
    const { error, count } = await sb.from(table).delete().neq("id", 0);
    if (error) {
      console.error(`✗ ${table}:`, error.message);
    } else {
      console.log(`✓ cleared ${table} (${count ?? "?"} rows)`);
    }
  }

  console.log("\nDone. All demo data removed.");
}

run().catch((e) => { console.error(e); process.exit(1); });
