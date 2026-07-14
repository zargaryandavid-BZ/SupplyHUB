# SupplyerHUB

Print House Partner & Supplier Management — route client orders to partners, collect competing quotes, and award the best offer.

## Tech stack

Next.js 14 (App Router) · React Server Components · **Supabase Postgres** · TypeScript strict mode

Data isolation is enforced server-side: all DB access uses the service-role key inside server components and server actions. Partners can never see client identities or rivals' quotes.

---

## Setup

### 1. Create a Supabase project

Go to [supabase.com](https://supabase.com), create a project, and grab your credentials from **Project Settings → API**:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Copy `.env.local.example` to `.env.local` and fill in those three values.

### 2. Apply the database schema

In the Supabase SQL editor (or with the Supabase CLI), run the migration files in order:

```
supabase/migrations/0001_init.sql    — schema
supabase/migrations/0002_seed.sql    — sample data (makes the demo clickable)
supabase/migrations/0003_test_helpers.sql  — reset_and_reseed() + update_sequences() functions
```

### 3. Install and run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # production build + type check
```

---

## Migrate existing local data (optional)

If you have data in `data/db.json` from Phase 1, import it into Supabase:

```bash
npm run migrate
# runs: npx tsx scripts/migrate-json-to-supabase.ts
```

---

## Try the full flow

1. Open [http://localhost:3000](http://localhost:3000) — use the **"Viewing as"** sidebar switcher.
2. Enter as **Distribution Manager** to see the requests board.
3. Open **"10,000 Tri-fold Brochures"** — one partner has quoted, one hasn't.
4. Switch to **ColorMax Press** or **BigFormat Co** and submit a quote.
5. Switch back to **Manager**, compare the quotes, and click **Award**.
6. Check the terminal — award notifications are printed there (email/SMS stubs).

---

## Running tests

Tests require a **local Supabase** instance (Docker + Supabase CLI):

```bash
# First time setup:
brew install supabase/tap/supabase   # install CLI
supabase init                        # one-time, in project root
supabase start                       # starts local Postgres + Studio

# Copy credentials from `supabase status` output:
cp .env.local.example .env.test
# fill in .env.test with the API URL and service_role key from `supabase status`

# Apply migrations to local instance:
supabase db reset   # applies all files in supabase/migrations/

# Run tests:
npm test
```

**Fallback:** if Docker is not available, point `.env.test` at a dedicated Supabase "test" project (separate from production) and run `supabase db push` to apply migrations there.

---

## Handy commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server at http://localhost:3000 |
| `npm run build` | Production build (also type-checks) |
| `npm test` | Run vitest against local Supabase |
| `npm run migrate` | Import data/db.json into Supabase (one-time) |
| `supabase start` | Start local Postgres for development/testing |
| `supabase db reset` | Re-apply all migrations to local DB |

---

## Phase roadmap

| Phase | Status | Description |
|---|---|---|
| **1** | ✅ Complete | Core loop on local JSON store |
| **2 (Step 1)** | ✅ **This release** | Supabase Postgres — same behaviour, no auth changes |
| **2 (Step 2)** | Planned | Real logins (Supabase Auth) + row-level security |
| **2 (Step 3)** | Planned | Logo & attachment storage → Supabase Storage (signed URLs) |
| **3** | Planned | Live notifications (Resend email + Twilio SMS) |
| **4** | Planned | Ratings, analytics, filters, mobile portal |

### Environment variables added in this release

| Variable | Where used |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + server — Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Reserved for Step 2 (RLS + anon client) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only** — bypasses RLS; never reaches the browser |

The `SUPABASE_SERVICE_ROLE_KEY` is imported exclusively through `lib/supabaseServer.ts` which starts with `import "server-only"`, making it a build error to import from any client component.
