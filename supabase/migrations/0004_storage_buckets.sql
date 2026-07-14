-- Storage bucket setup.
-- Running this SQL in the Supabase dashboard (SQL editor) or via `supabase db push`
-- creates both buckets idempotently. Alternatively, run:
--   npx tsx scripts/migrate-files-to-storage.ts
-- which calls ensureBuckets() programmatically before migrating files.
--
-- NOTE: Storage bucket DDL is not supported in standard PostgreSQL migrations.
-- Supabase stores bucket metadata in the internal `storage` schema.
-- The statements below use Supabase's storage helper functions.

-- partner-logos: PUBLIC bucket — logos are served via CDN public URLs.
insert into storage.buckets (id, name, public)
values ('partner-logos', 'partner-logos', true)
on conflict (id) do nothing;

-- request-attachments: PRIVATE bucket — artwork / spec files.
-- Access is via short-lived signed URLs generated server-side.
insert into storage.buckets (id, name, public)
values ('request-attachments', 'request-attachments', false)
on conflict (id) do nothing;
