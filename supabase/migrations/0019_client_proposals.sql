-- Client Quote Proposal module
-- Tables: client_proposals, proposal_options, client_contacts

create table if not exists client_proposals (
  id                 uuid primary key default gen_random_uuid(),
  request_id         int not null references product_requests(id) on delete cascade,
  quote_id           bigint,
  title              text not null default '',
  comment            text,
  markup_pct         numeric(6,2) not null default 20,
  client_name        text not null default '',
  client_email       text,
  client_phone       text,
  token              uuid not null unique default gen_random_uuid(),
  status             text not null default 'draft',
  approved_option_id uuid,
  sent_via           text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists proposal_options (
  id          uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references client_proposals(id) on delete cascade,
  label       text not null,
  base_price  numeric(12,2) not null,
  currency    text not null default 'USD',
  position    int not null default 0,
  created_at  timestamptz not null default now()
);

create table if not exists client_contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text,
  phone        text,
  last_used_at timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

create index if not exists idx_client_proposals_request_id on client_proposals(request_id);
create index if not exists idx_client_proposals_quote_id   on client_proposals(quote_id);
create index if not exists idx_client_proposals_token      on client_proposals(token);
create index if not exists idx_proposal_options_pid        on proposal_options(proposal_id, position);
create index if not exists idx_client_contacts_name        on client_contacts(name);
