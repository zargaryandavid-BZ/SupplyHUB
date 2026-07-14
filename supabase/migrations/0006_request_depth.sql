-- Additive, non-destructive: adds the Z dimension (depth) to product requests,
-- so box products can capture Width (X) × Height (Y) × Depth (Z).
-- Existing rows keep all data; new column defaults to NULL.

alter table product_requests
  add column if not exists depth numeric;
