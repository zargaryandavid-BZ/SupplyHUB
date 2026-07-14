# Ticket 004 — Move files to Supabase Storage (Phase 2 · Step 3 of 3)

> Read `CURSOR_BRIEF.md` and Ticket 003 first. Step 1 (Postgres) is done. This ticket
> moves **partner logos** and **request attachments** off the local filesystem
> (`public/uploads`) into **Supabase Storage**. The role switcher stays; real auth + RLS
> remain **Step 2** (a separate, later ticket).

## Goal
Uploaded files should live in Supabase Storage, not on the app server's disk (which
doesn't persist on most hosts and won't scale). Logos are non-sensitive → public bucket.
Request attachments may include client artwork → private bucket, served via short-lived
**signed URLs** generated server-side.

---

## 0. Manual setup (the human, in the Supabase dashboard)
Create two Storage buckets (Storage → New bucket):
1. **`partner-logos`** — Public bucket (ON).
2. **`request-attachments`** — Private bucket (public OFF).

No new env vars — reuse `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
Ticket 003. (Optional: Cursor may instead create the buckets idempotently in a setup
script using `supabaseAdmin().storage.createBucket(...)` — either is fine; document it.)

---

## 1. Storage helper — `lib/storage.ts` (server-only)
Wrap the Supabase Storage API so actions/pages don't repeat boilerplate. Use the existing
`supabaseAdmin()` client from `lib/supabaseServer.ts`.

```ts
import "server-only";
// object keys stored in the DB (not full URLs):
//   logo:       partner-<id>/<timestamp>.<ext>       in bucket "partner-logos"
//   attachment: req-<id>/<timestamp>-<rand>.<ext>    in bucket "request-attachments"

export async function uploadLogo(file: File, partnerId: number, oldKey?: string | null): Promise<string>
export function publicLogoUrl(key: string | null): string | null          // getPublicUrl (sync)
export async function removeLogo(key: string): Promise<void>

export async function uploadAttachment(file: File, requestId: number): Promise<string>  // returns key
export async function signedAttachmentUrl(key: string, expiresInSec?: number): Promise<string>  // default 3600
```
- `upload*` sets `contentType` from `file.type` and `upsert: false`.
- `uploadLogo` removes `oldKey` first (replace-on-update).
- Keep the existing validation (type in png/jpeg/webp/svg, ≤ 2 MB for logos) before upload.

## 2. Update write paths — `app/actions.ts`
- Replace the local-filesystem `writeLogoFile()` (currently writes to `public/uploads/`)
  with `uploadLogo()`. Store the returned **object key** in `partners.logo_path`.
  In `updatePartner`, pass the existing `logo_path` as `oldKey` so the previous file is
  removed from the bucket.
- In `createRequest`, replace the loop that writes attachment files to
  `public/uploads/req-<id>/…` with `uploadAttachment()`, and store the JSON array of
  **object keys** in `product_requests.attachments` (same column, now keys not local paths).
- Remove the now-unused `fs`/`path` file-writing code for these two features.

## 3. Update read/render paths
`logo_path` and `attachments` now hold storage **keys**, so resolve them to URLs when rendering:
- **Logos (public):** resolve with `publicLogoUrl(key)` (synchronous). Update:
  - `components/PartnerForm.tsx` — pass a resolved `logoUrl` in as a prop from the page
    (keep the Supabase client out of the shared form component), OR resolve inline since
    the form is a server component. Prefer passing `logoUrl` as a prop.
  - `app/manager/partners/page.tsx` — the directory avatar `<img>`.
- **Attachments (private):** the page is a server component, so `await signedAttachmentUrl(key)`
  for each attachment and pass the signed URLs to the render. Update wherever attachments
  are shown (e.g. `app/manager/requests/[id]/page.tsx` and the partner request detail).
  Signed URLs expire — generate them per request render, don't store them.

## 4. Backward-compatibility with legacy local paths
Existing rows may still have `logo_path` / `attachments` that start with `/uploads/…`
(local, from before this ticket). Make the resolvers tolerant:
- If a stored value starts with `/uploads/` (or `http`), treat it as a legacy/local path and
  return it as-is (Next still serves `public/uploads`).
- Otherwise treat it as a Storage object key and resolve public/signed URL.
This lets the app work before and after the data migration in §5.

## 5. One-time data migration — `scripts/migrate-files-to-storage.ts`
For each partner with a legacy `logo_path` under `public/uploads`, upload the file to the
`partner-logos` bucket and rewrite `logo_path` to the new key. Same for each request's
`attachments` → `request-attachments`. Document `npx tsx scripts/migrate-files-to-storage.ts`
in the README. After migration, `public/uploads/*` can be deleted (keep `.gitkeep`).

## 6. Tests
- Local Supabase (`supabase start`) includes Storage, so helpers can be tested there.
- Add a light `test/storage.test.ts`: upload a small in-memory file via `uploadLogo`/
  `uploadAttachment`, assert a key is returned, `publicLogoUrl` builds a URL, and
  `signedAttachmentUrl` returns a signed link; then `removeLogo` cleans up. Keep it minimal
  and skip gracefully if Storage isn't available in the env.
- Existing `test/data.test.ts` / `test/partners.test.ts` must stay green (`await` unchanged).

## 7. Definition of done
- New logo/attachment uploads land in Supabase Storage; DB stores object keys.
- Logos render via public URLs; attachments render via short-lived signed URLs.
- Replacing a logo deletes the old object; legacy `/uploads/…` values still render until migrated.
- Migration script moves existing files; `public/uploads` no longer receives new writes.
- `npm test` green, `npx tsc --noEmit` clean, `npm run build` compiles.
- Service-role key stays server-only (no Supabase client in any `"use client"` file).
- PR summary: buckets created, keys-not-URLs in DB, signed URLs for attachments, migration
  script, and a note that Storage RLS tightens when real auth lands in Step 2.

## Out of scope (the remaining migration step)
**Step 2 — Auth + RLS:** replace the role switcher with Supabase Auth (manager +
per-partner logins) and enforce partner data isolation with row-level security, including
Storage bucket policies keyed to the signed-in partner. Do this when you're ready to
introduce real logins.
