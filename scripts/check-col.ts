import { createClient } from "@supabase/supabase-js";

async function run() {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { error } = await sb.from("partners").select("internal_notes").limit(1);
  console.log(error ? "Column missing — run migration SQL in Supabase dashboard" : "✓ internal_notes column already exists");
}

run().catch(console.error);
