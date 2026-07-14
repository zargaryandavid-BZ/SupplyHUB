-- Additive, non-destructive: adds bank SWIFT/BIC and payment-terms fields to partners.
-- Existing rows keep all data; new columns default to NULL.
-- (Product images live inside the existing partners.products JSONB — no column needed.)

alter table partners
  add column if not exists swift text,
  add column if not exists payment_terms text;
