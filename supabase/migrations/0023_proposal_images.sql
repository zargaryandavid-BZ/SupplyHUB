alter table client_proposals
  add column if not exists images jsonb not null default '[]'::jsonb;
