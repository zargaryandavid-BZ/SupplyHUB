import { defineConfig } from "vitest/config";
import fs from "fs";
import path from "path";

/** Parse a simple KEY=VALUE .env file into an object (no interpolation). */
function parseEnvFile(filePath: string): Record<string, string> {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const result: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return result;
  } catch {
    return {};
  }
}

// Load .env.test so tests pick up the local Supabase URL + service-role key.
// Copy .env.local.example to .env.test and fill in your local Supabase credentials
// (from `supabase status` after running `supabase start`).
const testEnv = parseEnvFile(path.join(process.cwd(), ".env.test"));

export default defineConfig({
  test: {
    environment: "node",
    env: testEnv,
    include: ["test/**/*.test.ts"],
    // Run test files sequentially — each file calls resetDb() which truncates shared
    // tables; parallel execution causes race conditions.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      // `server-only` throws in plain Node/Vitest. Replace it with an empty stub
      // so server-side modules (supabaseServer, storage, data, partners) can be
      // imported in tests. The guard still works in Next.js builds.
      "server-only": path.resolve(process.cwd(), "test/__mocks__/server-only.ts"),
    },
  },
});
