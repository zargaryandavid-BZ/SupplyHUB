/**
 * Idempotently creates the two Supabase Storage buckets.
 * Run once:  npx tsx scripts/create-buckets.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false } });

const buckets = [
  { id: "partner-logos",        public: true  },
  { id: "request-attachments",  public: false },
  { id: "partner-products",     public: true  },
];

async function run() {
  for (const b of buckets) {
    const { error } = await sb.storage.createBucket(b.id, { public: b.public });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      console.error(`✗ ${b.id}: ${error.message}`);
    } else {
      console.log(`✓ ${b.id} (${b.public ? "public" : "private"})`);
    }
  }
}

run();
