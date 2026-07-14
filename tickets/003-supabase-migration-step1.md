# Ticket 003 — Migrate data layer to Supabase Postgres (Phase 2 · Step 1 of 3)

> Read `CURSOR_BRIEF.md` first. This is the first of three phased migration tickets.
> **Step 1 (this ticket):** move all persisted data from the local JSON store to
> Supabase Postgres, **keeping the existing cookie role switcher** so the app behaves
> exactly as today. **Step 2 (later):** real logins (Supabase Auth) + row-level security.
> **Step 3 (later):** move logos/attachments to Supabase Storage.

## Goal
Replace the `data/db.json` store (`lib/db.ts`) with Supabase Postgres, without changing
any screens' behaviour. All database access stays **server-side only** (server components
+ server actions), using the Supabase **service-role** key. No auth changes, no RLS yet,
files stay on the local filesystem.

---

## 0. Manual setup (the human does this — Cursor cannot)
1. Create a Supabase project at supabase.com. Choose a region close to the print house.
2. In Project Settings → API, copy: **Project URL**, **anon key**, **service_role key**.
3. Create `.env.local` in the repo root (already git-ignored — verify) with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (anon)
   SUPABASE_SERVICE_ROLE_KEY=eyJ... (service_role — server only, NEVER expose to browser)
   ```
4. (For local tests) install the Supabase CLI and Docker Desktop; `supabase init` then
   `supabase start` gives a local Postgres. See §6.

> Cursor: add `.env.local` and `.env.test` to `.gitignore` if not already covered, and
> commit a `.env.local.example` with the keys blank.

---

## 1. Dependencies
- Add `@supabase/supabase-js`.
- Add `server-only` (npm package) to hard-fail if the server client is ever imported into a client component.

## 2. Server Supabase client — `lib/supabaseServer.ts`
```ts
import "server-only";
import { createClient } from "@supabase/supabase-js";

export function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
```
- Service-role key bypasses RLS — that's acceptable in Step 1 because every query runs
  server-side and the role switcher still gates the UI. **Never** import this into a
  `"use client"` component. RLS + anon key come in Step 2.

## 3. Database schema — `supabase/migrations/0001_init.sql`
Mirror the current TypeScript types 1:1 so the app's shapes don't change. Use these
tables (snake_case, `bigint generated always as identity` primary keys):

- **clients** (id, name text not null, contact text, email text, phone text)
- **partners** (id, company text not null, contact, email, phone, categories text,
  rating numeric default 0, active int default 1, location, preferred_channels text,
  avg_delivery_days int, website, logo_path, bank_name, bank_account,
  portal_contact_name, portal_email, products jsonb default '[]'::jsonb,
  created_at text)  ← `products` stays JSONB to preserve the current array shape; we can
  normalise into a child table in a later ticket if needed.
- **orders** (id, client_id bigint, order_number text, notes text, created_at text)
- **product_requests** (id, order_id bigint, title text not null, category text,
  specs text, quantity int, needed_by text, hide_client int default 1,
  status text default 'draft', created_at text, standard_size text, width numeric,
  height numeric, size_unit text, material text, finishing text, attachments text)
- **dispatches** (id, request_id bigint, partner_id bigint, sent_at text,
  unique(request_id, partner_id))
- **quotes** (id, dispatch_id bigint, price numeric, currency text default 'USD',
  lead_time_days int, valid_until text, conditions text, status text default 'submitted',
  revision int default 1, created_at text)
- **messages** (id, request_id bigint, partner_id bigint, author_role text, text text,
  created_at text)

Notes:
- Keep date-ish fields (`needed_by`, `valid_until`, `created_at`, `sent_at`) as **text**
  and keep passing the app's existing `now()` string, so display code is unchanged.
- Add FK constraints where natural (orders.client_id, product_requests.order_id,
  dispatches.request_id/partner_id, quotes.dispatch_id, messages.request_id/partner_id).
- **Enable RLS is deferred to Step 2.** For Step 1, leave RLS disabled (default) — access
  is server-only via the service-role key.
- Add a `0002_seed.sql` (or a seed script) that inserts the current sample data
  (4 partners with their `products`, 3 clients, the seeded requests/dispatches/quotes/
  messages) so a fresh project is demoable.

## 4. Rewrite the data layer to async (the core change)
`@supabase/supabase-js` is **async**, so the data layer becomes async. Keep the **same
function names and return shapes** so callers change as little as possible.

- **`lib/data.ts`** — convert every read helper to `async` returning a `Promise`:
  `allPartners`, `activePartners`, `partnerById`, `partnerStats`, `allClients`,
  `managerRequests`, `requestDetail`, `partnerRequests`, `partnerRequestDetail`.
  Reimplement each with Supabase queries (`.from(...).select(...)`), assembling the same
  nested objects the pages already expect (e.g. `requestDetail` returns `{request, offers,
  messages}`). Preserve current sorting/filtering and the **partner-isolation** guarantees
  (a partner only ever gets their own dispatched requests; never expose client identity or
  rival quotes to partner views).
- **`lib/partners.ts`** — convert `addPartner`, `updatePartner`, `deletePartner`,
  `partnerHasHistory`, `setPartnerActive` to async Supabase writes. `inviteMessageFor`
  stays pure/sync.
- **`lib/db.ts`** — remove the JSON store, `now()` helper can move to `lib/util.ts`.
  Remove `resetDbForTests` (replaced by the test reset in §6).

## 5. Update all callers to `await`
- Every **server component** page that reads data becomes an `async function` and
  `await`s the helpers. Files: `app/manager/page.tsx`, `app/manager/requests/[id]/page.tsx`,
  `app/manager/requests/new/page.tsx`, `app/manager/partners/page.tsx`,
  `app/manager/partners/[id]/edit/page.tsx`, `app/partner/page.tsx`,
  `app/partner/requests/[id]/page.tsx`, `app/page.tsx`, and `components/Sidebar.tsx`
  (it reads partners for the switcher — make it async or pass data in as a prop).
- **`lib/session.ts` `getActor()`** currently calls `partnerById` — make it async and
  update its callers to `await getActor()`.
- **`app/actions.ts`** server actions are already async — add `await` to every data call.
  Logo/attachment file writes stay on the local filesystem for now (Step 3 moves them).
- One-time data import: `scripts/migrate-json-to-supabase.ts` that reads an existing
  `data/db.json` (if present) and inserts it into Supabase, so the current local data
  moves over. Document `npx tsx scripts/migrate-json-to-supabase.ts` in the README.

## 6. Tests (keep them meaningful)
Vitest currently hits the JSON store. Point tests at a **local Supabase** instead:
- Prereq: Docker + Supabase CLI; `supabase start` runs Postgres locally and applies
  `supabase/migrations`. Put its local URL + service-role key in `.env.test`.
- Replace `resetDbForTests()` with a `resetDb()` that truncates all tables and re-inserts
  the seed (run in `beforeEach`). Update `vitest.config.ts` to load `.env.test`.
- **Keep the existing assertions** in `test/data.test.ts` and `test/partners.test.ts`
  (isolation, delete-vs-deactivate, win-rate, product fields) — just `await` the now-async
  helpers. This proves behaviour is unchanged after the migration.
- If Docker isn't available in the dev environment, the fallback is a dedicated Supabase
  "test" project via `.env.test` keys — note this in the README, but prefer local.

## 7. Definition of done
- `.env.local` drives a working app against Supabase; `data/db.json` is no longer used.
- Every screen works exactly as before (create request, product→partner picker, quotes,
  award, partner CRUD + products, logo upload still saving locally).
- Existing local data imported via the migration script (or a fresh seed loaded).
- `npm test` green against local Supabase; `npx tsc --noEmit` clean; `npm run build` compiles.
- Service-role key never reaches the browser (grep the client bundle / confirm `server-only`).
- PR summary lists: new env vars, the schema file, the async refactor, and the test setup;
  and explicitly notes RLS + auth are Step 2 and Storage is Step 3.

## Out of scope (next tickets)
- **Step 2:** Supabase Auth (manager + partner logins) replacing the role switcher, and
  RLS policies enforcing partner isolation at the database (switch server reads to the
  user's session/anon client instead of service-role).
- **Step 3:** move logo + request attachments to Supabase Storage with signed URLs.
