-- Partner order feedback: distribution manager rates each won/delivered order
-- One row per awarded dispatch. Ratings 1–5 across four dimensions.

create table if not exists partner_feedback (
  id                   bigserial primary key,
  dispatch_id          bigint not null unique references dispatches(id) on delete cascade,
  partner_id           bigint not null references partners(id) on delete cascade,
  request_id           bigint not null references product_requests(id) on delete cascade,
  quality_rating       smallint check (quality_rating between 1 and 5),
  quantity_rating      smallint check (quantity_rating between 1 and 5),
  satisfaction_rating  smallint check (satisfaction_rating between 1 and 5),
  timing_rating        smallint check (timing_rating between 1 and 5),
  notes                text,
  created_at           timestamptz default now(),
  updated_at           timestamptz default now()
);

-- Index for fast look-ups by partner
create index if not exists partner_feedback_partner_idx on partner_feedback(partner_id);
