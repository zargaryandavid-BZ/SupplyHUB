import { createClient } from "@supabase/supabase-js";

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars. Set them before running.");

  const sb = createClient(url, key);

  const steps: [string, () => Promise<unknown>][] = [
    ["partner_feedback", () => sb.from("partner_feedback").delete().neq("id", 0)],
    ["messages",         () => sb.from("messages").delete().neq("id", 0)],
    ["quotes",           () => sb.from("quotes").delete().neq("id", 0)],
    ["dispatches",       () => sb.from("dispatches").delete().neq("id", 0)],
    ["product_requests", () => sb.from("product_requests").delete().neq("id", 0)],
    ["partners",         () => sb.from("partners").delete().neq("id", 0)],
  ];

  for (const [table, fn] of steps) {
    const { error, count } = await (fn() as ReturnType<typeof sb.from>);
    if (error) {
      console.error(`✗ ${table}:`, error.message);
    } else {
      console.log(`✓ cleared ${table} (${count ?? "?"} rows)`);
    }
  }

  console.log("\nDone. All demo data removed.");
}

run().catch((e) => { console.error(e); process.exit(1); });
