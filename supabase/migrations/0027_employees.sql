-- Employee team management
-- Adds: employees table, owner_id on product_requests, actor_uuid on auth_sessions

create table if not exists employees (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null unique,
  phone      text,
  position   text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_employees_email on employees(email);

alter table product_requests
  add column if not exists owner_id uuid references employees(id) on delete set null;

alter table auth_sessions
  add column if not exists actor_uuid text;
