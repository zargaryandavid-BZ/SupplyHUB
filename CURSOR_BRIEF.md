# SupplyHUB — Project Brief for Cursor AI

> **How we work together.** There are three roles on this project:
> - **The owner (human)** runs a print house and directs priorities.
> - **Claude (advisor/architect)** designs the data model, workflows, and technical direction, and writes tickets/specs like the ones below.
> - **You, Cursor AI (developer)** implement those specs in this repo: write and edit code, run it locally, fix bugs, and keep the codebase clean.
>
> When you get a task, implement it end to end, follow the existing conventions in this file, and don't introduce new frameworks or dependencies without a good reason (call it out if you do). If a spec is ambiguous, make the smallest reasonable assumption, implement it, and note the assumption in your summary.

---

## 1. What this product is

SupplyHUB is an internal web platform for a **print house** that outsources some jobs to a network of **partners/suppliers**.

The business situation it solves:
- The print house receives orders from **clients**.
- Some products the print house cannot produce in-house, or can't do at the best price/lead time.
- For those, a **Distribution Manager** sends the product request to one or more **partners**, who each respond with a **price + lead time + conditions**.
- The manager compares the offers and **awards** the job to one partner.

The core loop in one line:

> Client order → Manager creates a product request → sends it to several partners → partners quote independently → manager compares and awards a winner → everyone is notified.

### Two separated worlds (critical rule)
- **Manager world (internal):** sees clients, all partners, all quotes, internal notes.
- **Partner world (external):** a partner sees **only the requests sent to them**. They must **never** see the client's identity, other partners, or other partners' prices.

Keep this separation intact in every feature. Never leak internal data into partner-facing pages or queries.

---

## 2. Domain model (entities)

Defined in `lib/types.ts` and stored via `lib/db.ts`.

| Entity | Purpose | Key fields |
|---|---|---|
| `Client` | The end customer (internal only) | name, contact, email, phone |
| `Order` | A job from a client; groups requests | client_id, order_number, notes |
| `ProductRequest` | One item to be quoted — the unit sent to partners | title, category, specs, quantity, needed_by, status |
| `Partner` | A supplier who can receive & quote requests | company, contact, email, phone, categories, rating, active |
| `Dispatch` | The link "this request was sent to this partner" (one request → many dispatches) | request_id, partner_id, sent_at |
| `Quote` | A partner's offer for a dispatch (revisable) | dispatch_id, price, currency, lead_time_days, valid_until, conditions, status, revision |
| `Message` | Threaded question/comment on a request | request_id, partner_id, author_role, text |

**Relationships:** Client → Orders → ProductRequests → Dispatches (one per partner) → each Dispatch has one Quote and its own Message thread.

**ProductRequest status flow:** `draft → sent → quoting → clarifying → awarded → closed`
- `sent` when dispatched to ≥1 partner
- `quoting` when a partner submits a quote
- `clarifying` when a partner posts a question
- `awarded` when the manager picks a winner (that quote → `won`, all others → `lost`)

---

## 3. Tech stack & architecture

Keep it simple and mainstream. Current stack:

- **Next.js 14 (App Router)** with **React Server Components** — pages are server components that read data directly.
- **Server Actions** (in `app/actions.ts`, marked `"use server"`) handle all mutations. Forms post to these actions via `<form action={serverAction}>`. No separate REST/GraphQL API layer.
- **Data store:** a **zero-dependency JSON file** at `data/db.json`, managed by `lib/db.ts`. There is **no SQL database and no ORM** right now. This was a deliberate choice so `npm install` works on any machine with no native modules or cloud accounts.
- **Auth:** none yet. A cookie `shub_actor` holds either `manager` or `partner:<id>`; `lib/session.ts` reads it. A sidebar "Viewing as" switcher lets you impersonate the manager or any partner. This is a **local dev stand-in** for real logins.
- **Styling:** a single hand-written CSS file `app/globals.css` using CSS variables and semantic class names (`.card`, `.badge`, `.compare`, `.offer`, `.btn`, etc.). **No Tailwind, no CSS framework** — keep using these classes.
- **Notifications:** stubbed in `lib/notify.ts` — currently `console.log`s what would be an email/SMS. This is the seam where Resend (email) and Twilio (SMS) will plug in.
- **Language:** TypeScript, strict mode. Keep `npx tsc --noEmit` passing.

### File map
```
app/
  layout.tsx                      root layout + globals.css
  globals.css                     all styling (CSS variables + classes)
  page.tsx                        landing / role picker
  actions.ts                      ALL server actions (mutations)
  manager/
    page.tsx                      requests board (grouped by status)
    requests/new/page.tsx         create a request + dispatch to partners
    requests/[id]/page.tsx        detail: compare quotes, award, Q&A, send to more partners
    partners/page.tsx             partner directory + stats
    partners/new/page.tsx         add a partner
  partner/
    page.tsx                      "My requests" (only this partner's)
    requests/[id]/page.tsx        detail: submit/revise quote, Q&A, win/loss
components/
  Sidebar.tsx                     nav + role switcher (server component)
  Badge.tsx                       status pill
lib/
  types.ts                        entity types + status labels/order
  db.ts                           JSON store: db(), save(), nextId(), now(), seed()
  data.ts                         read/query helpers (pure functions over db())
  session.ts                      getActor() from cookie
  notify.ts                       email/SMS stub
data/db.json                      generated at first run (git-ignored)
```

---

## 4. Conventions (follow these)

- **Reads** go through helper functions in `lib/data.ts` (e.g. `managerRequests()`, `requestDetail(id)`, `partnerRequests(partnerId)`). Add new read helpers there rather than querying `db()` inline in pages.
- **Writes** are server actions in `app/actions.ts`. After mutating, call `save()` (persist JSON), then `revalidatePath(...)` and/or `redirect(...)`.
- **IDs:** use `nextId(collection)` from `lib/db.ts`. **Timestamps:** use `now()`.
- **Access control:** every manager page starts with `if (getActor().role !== "manager") redirect("/")`. Partner pages check `role !== "partner"`. Partner data helpers take a `partnerId` and must filter to that partner only.
- **Pages that read cookies/data** set `export const dynamic = "force-dynamic"`.
- **Styling:** reuse existing classes in `globals.css`. If you need a new visual element, add a small, clearly-named class there — don't inline large style objects and don't add a CSS framework.
- **No new dependencies** unless necessary. If a task truly needs one, flag it and explain why before adding.
- **Keep the two worlds separate** (see §1). Double-check any new partner-facing query never returns client identity or rival quotes.
- Keep `npx tsc --noEmit` clean and make sure `npm run build` compiles before declaring a task done.

### Testing policy (important)
We use **Vitest** (`npm test`). We are **not** doing strict test-first TDD everywhere, but:
- **Any change to business logic in `lib/data.ts` or `app/actions.ts` must ship with tests.** For the tricky, high-risk behaviours — **partner data isolation**, **awarding a winner**, **status transitions**, **quote revisions** — write the test **first**, watch it fail, then implement.
- UI/layout/styling changes don't require tests; verify those with `npm run build`.
- Every task must end with `npm test` green **and** `npx tsc --noEmit` clean.
- Tests live in `test/**/*.test.ts`. Use `resetDbForTests()` (from `lib/db.ts`) in `beforeEach` for a fresh seeded database. Tests read/write an **isolated** store in the OS temp dir (configured in `vitest.config.ts` via `SHUB_DATA_DIR`), so they never touch the real `data/db.json`.
- When you add a feature, add at least one test proving the happy path and one proving the data-isolation / access-control guard still holds.
- `test/data.test.ts` is the reference example — follow its style.

---

## 5. How to run it

```bash
npm install      # first time (or after moving machines: rm -rf node_modules package-lock.json .next first)
npm run dev      # http://localhost:3000
npm run build    # production build / type + compile check
npm test         # run the Vitest suite once
npm run test:watch # tests in watch mode (use while developing / doing TDD)
npm run reset-db # wipe data/db.json and re-seed sample data on next start
```

The app seeds sample clients, partners, and requests on first run so the whole flow is clickable immediately. Use the sidebar "Viewing as" switcher to move between the manager and partners.

---

## 6. Roadmap (where we're headed)

Current state = **Phase 1 complete**: the full core loop works on local data.

Likely upcoming work (Claude will spec these as tickets):
1. **Real authentication & multi-user** — replace the cookie role switcher with real logins and roles (manager vs partner). Introduce a real database (**Supabase / Postgres**) with **row-level security** so partner data isolation is enforced at the DB layer, not just in the UI.
2. **Live notifications** — wire `lib/notify.ts` to **Resend** (email) and **Twilio** (SMS) for the events: request sent, new question/answer, quote submitted, deadline reminder, awarded (won/lost).
3. **File attachments** — let managers attach artwork/spec files to a request and partners download them (signed URLs).
4. **Ratings & analytics** — partner performance (win rate, response time, price rank) feeding partner suggestions when creating a request.
5. **Polish** — filters/search on the board, mobile-friendly partner portal, editable notification templates/languages.

When migrating to a real database, **preserve the entity shapes in `lib/types.ts`** so the transition from the JSON store is mechanical.

---

## 7. Your working style as the developer

- Implement the requested ticket fully; don't leave TODOs unless asked.
- Match existing patterns before inventing new ones.
- After a change: run `npm test` and `npx tsc --noEmit`, confirm both are green, and give a short summary of what changed and any assumptions.
- For risky logic (isolation, awarding, status flow), write the failing test first.
- If you spot a bug or a data-isolation risk while working, flag it clearly.
- Prefer small, readable functions and clear names over cleverness. A non-developer owner will read this code.
```
