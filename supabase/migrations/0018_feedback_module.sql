-- Feedback & Improvements module
-- Tables: feedback, feedback_images + private storage bucket

create table if not exists feedback (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    int,
  user_id      int,
  display_name text not null default '',
  type         text not null,
  page         text not null,
  title        text not null,
  comment      text not null,
  status       text not null default 'open',
  admin_note   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists feedback_images (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    int,
  feedback_id  uuid not null references feedback(id) on delete cascade,
  file_name    text not null,
  file_size    bigint not null,
  mime_type    text not null,
  storage_path text not null,
  position     int not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists idx_feedback_created_at on feedback(created_at desc);
create index if not exists idx_feedback_images_feedback_id on feedback_images(feedback_id);

-- Private storage bucket (10 MB limit per file, images only)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-images', 'feedback-images', false, 10485760, array['image/jpeg','image/png','image/gif','image/webp','image/svg+xml'])
on conflict (id) do nothing;
