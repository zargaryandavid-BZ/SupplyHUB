-- Additive: partner EIN (Employer Identification Number).
alter table partners
  add column if not exists ein text;
