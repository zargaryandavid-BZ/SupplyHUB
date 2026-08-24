-- Vendor contact management: multiple named contacts per partner
create table if not exists partner_contacts (
  id         serial primary key,
  partner_id integer not null references partners(id) on delete cascade,
  name       text not null,
  title      text,
  email      text,
  phone      text,
  notes      text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_partner_contacts_partner_id on partner_contacts(partner_id);
