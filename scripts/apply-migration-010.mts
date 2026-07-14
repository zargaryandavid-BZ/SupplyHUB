import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(url, key);

const sql = readFileSync("supabase/migrations/0010_sms_update_template.sql", "utf8");

// Execute via Supabase SQL endpoint
const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ sql }),
});

if (!res.ok) {
  console.log("⚠️  Could not auto-run migration. Run this SQL in your Supabase SQL editor:");
  console.log("\n" + sql);
} else {
  console.log("✅ Migration 0010 applied successfully.");
}
