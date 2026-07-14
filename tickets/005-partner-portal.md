# Ticket 005 — Partner portal: unique-link access, requests table, chat, submit quote, notifications

> Target: **SupplyHUB** (Next.js, Supabase, running on :3002). Build on what exists:
> `app/partner/*`, `lib/data.ts` (`partnerRequests`, `partnerRequestDetail`), the
> `submitQuote` / `postMessage` server actions in `app/actions.ts`, the `notify()` stub in
> `lib/notify.ts`, and the `partners` / `dispatches` / `quotes` / `messages` tables.
> Read `CURSOR_BRIEF.md` first; follow its conventions and the **partner data-isolation rule**.

## Goal
Give each partner a private portal where they:
1. access via their **own unique link** (optionally confirmed by contact name),
2. see **all requests sent to them in a table**, with full detail per row,
3. **chat** with the distributor per request to ask questions before quoting,
4. **submit their quote** ("Send quote"), and
5. get **notifications** (email + SMS/WhatsApp + in-app) when info is sent or received.

---

## STEP 0 — Data safety (additive, back up first)
Same rules as prior tickets: back up, additive-only migration, verify row counts, reversible.
New migration `0007_partner_portal.sql`:
```sql
-- Unique access token per partner (the private link)
alter table partners add column if not exists access_token text unique;
-- Backfill tokens for existing partners
update partners set access_token = encode(gen_random_bytes(18), 'hex') where access_token is null;

-- Read tracking for in-app unread badges (messages already exist)
alter table messages
  add column if not exists read_by_partner boolean not null default false,
  add column if not exists read_by_manager boolean not null default false;
```
(`gen_random_bytes` needs `pgcrypto` — `create extension if not exists pgcrypto;` if not enabled.)

---

## STEP 1 — Unique-link access + partner session
- On partner **create** (and in the invite in `inviteMessageFor`), include the private URL:
  `"{APP_URL}/partner/access/{access_token}"`. Send it via the partner's `preferred_channels`
  (email + SMS/WhatsApp) through `notify()`.
- New route **`app/partner/access/[token]/page.tsx`**:
  - Resolve `token → partner` (server-side, service role). If not found → friendly "invalid or
    expired link" page.
  - Show a small confirm step: "Enter your name to continue" comparing against
    `portal_contact_name` (case-insensitive). On match, set an **httpOnly cookie**
    `shub_partner=<partnerId>` (sign it or store the token) and redirect to `/partner`.
    (Name step can be skipped if you prefer link-only — keep it as a light guard.)
- Update `lib/session.ts` `getActor()`: for the partner side, resolve the partner from the
  `shub_partner` cookie (keep the existing dev role-switcher working too). All partner data
  queries must scope to **that** partnerId only — never expose other partners or the client
  behind a request.
- Add a "Sign out" that clears the cookie.

> SECURITY NOTE (call out in the PR): a unique link means anyone holding it can enter.
> Use long random tokens (done above), allow the manager to **rotate/revoke** a token
> (add a "Regenerate link" button on the partner edit page), and keep all access server-side.
> Full Supabase Auth + RLS remains the eventual hardening step (deferred) — this ticket is
> token-based access, not row-level security.

---

## STEP 2 — Requests table (`app/partner/page.tsx`)
Replace/upgrade the current list with a **table** of the partner's dispatched requests
(from `partnerRequests(partnerId)`), columns:
`Product/Title · Qty · Size (W×H×D unit) · Needed by · Status · Your quote (status + price) ·
Unread (chat badge) · Action (Open)`.
- Group or filter by state: **Needs quote / Quoted / Won / Lost** (tabs or a status column).
- Empty state when nothing has been sent yet.

---

## STEP 3 — Request detail (`app/partner/requests/[id]/page.tsx`)
Guard: the request must be dispatched to this partner (use `partnerRequestDetail`). Show:
- **Full request detail**: title, product, quantity, dimensions incl. **depth (Z)**, unit,
  finishing, specs, and **reference images/files** (download via signed URLs — files are in
  Supabase Storage per Ticket 004).
- **Communication panel** (chat) — see Step 4.
- **Submit-quote panel** — see Step 5.
- Never show client identity or other partners' quotes.

---

## STEP 4 — Chat / communication (per request)
- A **"Communication" section/button** on the request detail: a threaded chat using the
  existing `messages` table (`request_id`, `partner_id`, `author_role`, `text`). Partner posts
  questions (`postMessage` with `author_role="partner"`); manager replies from the manager
  request-detail page (already threaded).
- **Mark-as-read**: when the partner opens a request, set `read_by_partner = true` on all
  `author_role='manager'` messages for that request; do the mirror on the manager side.
- **Unread badge**: on the requests table row and a header count = messages authored by the
  other party that aren't read yet.

---

## STEP 5 — Submit quote ("Send quote")
- A clear **"Send quote"** button/form on the request detail (reuse `submitQuote`): price,
  currency, lead time (days), valid-until, conditions. On submit → request status becomes
  `quoting`, quote saved/revised, and the manager is notified.
- Partner can **revise** their quote until the request is awarded; after award show a read-only
  "You won / Not selected this time" banner (data already supports this).

---

## STEP 6 — Notifications (email + SMS/WhatsApp + in-app)
Fire on these events, to the right recipient, via `notify()` (which will route to Resend +
Twilio once wired — for now it logs; note that in the PR):
- Request **sent** to partner → partner (email + SMS/WhatsApp per `preferred_channels`).
- New **chat message** → the other party (email + SMS/WhatsApp + in-app unread).
- **Quote submitted / revised** → manager (email + in-app).
- **Awarded** (won / lost) → partner (email + SMS/WhatsApp for the winner).
In-app: unread badges (Step 4) plus a toast on the current screen when a new message/quote
arrives (reuse existing toast component if present).

---

## STEP 7 — Definition of done
- A partner opens their unique link, confirms name, lands on their portal, and sees **only**
  their own requests in a table with full detail.
- They can open a request, chat with the distributor, and submit/revise a quote; the manager
  sees the message and quote, and notifications fire (visible in server console for now).
- Unread badges update correctly on both sides; award result shows to the partner.
- Data isolation holds: no cross-partner data, no client identity leaked (extend
  `test/data.test.ts` isolation tests to cover token→partner resolution).
- Migration backed up + additive; row counts unchanged; `npm test`, `npx tsc --noEmit`,
  `npm run build` all pass.
- Manager can **regenerate/revoke** a partner's access link.
- PR notes: real email/SMS delivery still pending the Resend/Twilio wiring, and that
  full Supabase Auth + RLS is the later hardening step.

## Out of scope (later)
Real Supabase Auth + row-level security (replace token access), read receipts beyond unread
counts, and file attachments inside chat messages.
