import { createClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client pointed at the local test database
 * (credentials from .env.test, loaded by vitest.config.ts).
 */
function testClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.test. " +
        "Run `supabase start` and populate .env.test with the local credentials."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Truncates all tables, resets sequences, and re-inserts seed data.
 * Calls the reset_and_reseed() stored procedure defined in
 * supabase/migrations/0003_test_helpers.sql.
 * Run in beforeEach so every test starts from a known state.
 */
export async function resetDb() {
  const { error } = await testClient().rpc("reset_and_reseed");
  if (error) {
    throw new Error(`resetDb failed: ${error.message}. Did you apply all migrations (including 0003_test_helpers.sql)?`);
  }
}
