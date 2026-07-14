# Ticket 001 — Partner directory: full CRUD, expanded profile, and invites

> Read `CURSOR_BRIEF.md` first. Follow every convention there (server actions for
> writes, read helpers in `lib/data.ts`, `nextId()`/`now()`, access-control guards,
> reuse `globals.css` classes, keep the two worlds separate, TDD for risky logic,
> end with `npm test` + `npx tsc --noEmit` green).

## Goal
Turn the partner directory from read-only into a full editable/deletable directory,
expand the partner profile with new fields, support a real logo upload, and send an
invitation (email / SMS) when a partner is added.

---

## 1. Data model changes

### 1.1 Extend the `Partner` type — `lib/types.ts`
Add these fields to `Partner` (keep existing: `id, company, contact, email, phone, categories, rating, active`):

```ts
location: string | null;            // e.g. "Yerevan, AM" or "Chicago, US"
preferred_channels: string | null;  // comma list from: email,sms,whatsapp,phone
avg_delivery_days: number | null;   // average delivery time in days
website: string | null;
logo_path: string | null;           // e.g. "/uploads/partner-3-1720000000.png"
bank_name: string | null;
bank_account: string | null;        // IBAN / account no. — SENSITIVE (see §6)
portal_contact_name: string | null; // the person who logs into their portal
portal_email: string | null;        // email used for portal access + invites
```

### 1.2 Seed — `lib/db.ts`
Give the 4 seeded partners sensible values for the new fields (so the UI has data to
show). Example for PrintPro: `location: "Chicago, US"`, `preferred_channels: "email,whatsapp"`,
`avg_delivery_days: 14`, `website: "https://printpro.example.com"`, `logo_path: null`,
`bank_name: "First Chicago Bank"`, `bank_account: "US00 0000 0000 0001"`,
`portal_contact_name: "Alex Novak"`, `portal_email: "alex@printpro.com"`.

### 1.3 Backward-compat for existing `data/db.json`
Users already have a `data/db.json` seeded with the old shape. Do **not** force a reset.
In `lib/data.ts` (or a small normaliser in `db()`), treat missing new fields as `null`
so old records keep working. New reads must never assume the new keys exist.

---

## 2. Refactor for testability (do this first)

Server actions can't be unit-tested easily (they call `cookies()`/`redirect()`).
Extract the pure logic into a new module **`lib/partners.ts`** that mutates `db()` +
`save()` and returns a result — no Next APIs:

```ts
export type PartnerInput = { company: string; contact?: string; email?: string;
  phone?: string; categories?: string; location?: string; preferred_channels?: string;
  avg_delivery_days?: number | null; website?: string; bank_name?: string;
  bank_account?: string; portal_contact_name?: string; portal_email?: string;
  logo_path?: string | null; };

export function addPartner(input: PartnerInput): Partner
export function updatePartner(id: number, input: Partial<PartnerInput>): Partner | undefined
export function deletePartner(id: number): { ok: true } | { ok: false; reason: "has_history" }
export function setPartnerActive(id: number, active: boolean): void
export function partnerHasHistory(id: number): boolean   // true if any dispatch references it
export function inviteMessageFor(p: Partner): { channels: string[]; to: string; subject: string; body: string }
```

The server actions in `app/actions.ts` become thin wrappers: parse `FormData`, handle
the logo file, call these functions, call `notify()`, then `revalidatePath` + `redirect`.

---

## 3. Delete vs deactivate (important safety behaviour)
Partners are referenced by historical `dispatches`/`quotes`. Deleting one that has
history would orphan those rows and break `requestDetail`.

Rules:
- **`deletePartner(id)`** performs a hard delete **only if `partnerHasHistory(id)` is false**.
  If it has history, return `{ ok: false, reason: "has_history" }` and do **not** delete.
- The UI, on a blocked delete, shows: "This partner has quote history and can't be
  deleted. Deactivate them instead." and offers a **Deactivate** action
  (`setPartnerActive(id, false)`), which hides them from the "send to partners" pickers
  but keeps history intact. Deactivated partners can be reactivated.

---

## 4. Server actions — `app/actions.ts`
- Extend **`createPartner`**: parse all new fields, handle logo upload (§5), call
  `addPartner(...)`, then send the invite (§7).
- Add **`updatePartner`** action: same fields, replace logo if a new file is provided,
  call `lib/partners.updatePartner`.
- Add **`deletePartner`** action: call `lib/partners.deletePartner`; on `has_history`,
  redirect back with `?error=has_history`.
- Add **`togglePartnerActive`** action.
All redirect to `/manager/partners` (or the edit page) and `revalidatePath` appropriately.
Guard every action for `getActor().role === "manager"`.

---

## 5. Logo upload (real file)
- Form posts `multipart/form-data`; the field is `<input type="file" name="logo" accept="image/*">`.
- In the action: `const file = formData.get("logo") as File | null;` if `file && file.size > 0`:
  - Validate: type in `image/png,image/jpeg,image/webp,image/svg+xml`; size ≤ 2 MB. On
    failure, redirect back with `?error=logo`.
  - Save to `public/uploads/partner-<id>-<Date.now()>.<ext>` via
    `fs.writeFileSync(path, Buffer.from(await file.arrayBuffer()))`.
  - Store the public path `/uploads/<filename>` in `logo_path`.
  - On update, delete the previous file if it existed.
- Create `public/uploads/` with a committed `.gitkeep`; add `public/uploads/*` (except
  `.gitkeep`) to `.gitignore`. Next serves `/public` at the web root, so
  `<img src={partner.logo_path} />` works. If `logo_path` is null, show an initials avatar
  (first letters of `company`) in a circular chip — reuse a new `.avatar` class in `globals.css`.

---

## 6. Sensitive data note (bank details)
`bank_account` is sensitive. For this local build, store as-is but:
- Never log it (keep it out of `notify()` bodies and `console.log`).
- Only render it on the manager edit screen, never in the partner portal or any
  partner-facing query.
- Add a code comment marking it for encryption when we migrate to Supabase.

---

## 7. Invitation on add
When a partner is created (and optionally when `portal_email` is first set), send an
invite via the partner's `preferred_channels` (fall back to email if none set):
- Build it with `inviteMessageFor(partner)`.
- Send through the existing `notify()` stub (email + SMS/WhatsApp lines print to the
  server console for now). Address it to `portal_email || email` and `phone`.
- Subject e.g. "You've been invited to SupplyHUB"; body names the company and the
  portal-access person.
- **Note in the PR description** that real delivery needs the Resend/Twilio wiring
  (Phase 3) — this ticket only fires the stub.

---

## 8. UI

### 8.1 Directory table — `app/manager/partners/page.tsx`
Keep it readable; don't dump every field into the table. Columns:
`Logo+Company` · `Contact` · `Location` · `Categories` · `Avg delivery` · `Channels` ·
`Win rate` · `Actions`.
- Logo: small circular `<img>` or initials avatar next to the company name.
- Channels: small pills (reuse `.badge`, add neutral variants) or icon set.
- Avg delivery: `{n} days` or `—`.
- Actions column: **Edit** (link to `/manager/partners/[id]/edit`) and **Delete** (a
  `<form action={deletePartner}>` with a confirm). Deactivated partners render dimmed
  with a "Deactivated" badge and a **Reactivate** action.
- Show the `?error=has_history` message as a `.notice` banner when present.

### 8.2 Shared form — `components/PartnerForm.tsx`
One component used by both new and edit pages. Group fields into `.card` sections:
- **Basics:** company*, contact, categories, location, website.
- **Contact & channels:** email, phone, preferred channels (checkboxes: Email, SMS,
  WhatsApp, Phone call), avg delivery days.
- **Portal access:** portal contact name, portal email.
- **Financial (sensitive):** bank name, bank account — with a small "stored securely in
  production" helper note.
- **Logo:** file input; if editing and a logo exists, show current logo with a "replace" hint.
Props: `partner?` (for edit) and the `action` to post to. `enctype="multipart/form-data"`.

### 8.3 Pages
- `app/manager/partners/new/page.tsx` → renders `PartnerForm` posting to `createRequest`… no —
  posting to `createPartner`.
- `app/manager/partners/[id]/edit/page.tsx` → loads the partner via a new
  `partnerById` read (already exists in `lib/data.ts`), renders `PartnerForm` prefilled,
  posts to `updatePartner`, and includes the Delete/Deactivate controls.
- Guard both for manager role.

---

## 9. Tests to write FIRST — `test/partners.test.ts`
Use `resetDbForTests()` in `beforeEach`. Write these before implementing §2–§4:

1. `addPartner` creates a partner and persists all new fields (location, channels,
   avg_delivery_days, website, bank_name, bank_account, portal_contact_name,
   portal_email); defaults `active=1`, `rating=0`.
2. `updatePartner` changes fields and leaves others intact; returns the updated partner;
   returns `undefined` for an unknown id.
3. `deletePartner` hard-deletes a partner with **no** history (e.g. EcoPack, id 4) →
   `{ ok: true }` and it's gone from `allPartners()`.
4. `deletePartner` on a partner **with** history (e.g. PrintPro, id 1, which has a
   dispatch) → `{ ok: false, reason: "has_history" }` and the partner still exists.
5. `setPartnerActive(id, false)` hides the partner from `activePartners()` but keeps it
   in `allPartners()`; reactivating restores it.
6. `inviteMessageFor(partner)` returns the channels from `preferred_channels` (falls back
   to `["email"]` when empty) and addresses `portal_email || email`.
7. Regression: the existing `test/data.test.ts` isolation tests still pass, and
   `partnerRequestDetail`/`partnerRequests` never expose the new sensitive fields to a
   partner beyond what they already return.

---

## 10. Definition of done
- All tests green (`npm test`), `npx tsc --noEmit` clean, `npm run build` compiles.
- Manager can add, edit, deactivate/reactivate, and delete (when no history) partners.
- Logo uploads save and display; initials avatar fallback works.
- Adding a partner fires an invite via the chosen channel(s) (visible in server console).
- Partner portal shows **no** new sensitive fields (bank, portal access) — verify.
- Short PR summary listing new fields, the delete-vs-deactivate rule, and the note that
  real email/SMS delivery is still pending Phase 3.

## Out of scope (later tickets)
Real email/SMS delivery (Resend/Twilio), real partner logins/auth, cloud file storage,
encryption of bank details.
