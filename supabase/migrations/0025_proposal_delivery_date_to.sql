alter table client_proposals
  add column if not exists delivery_date_to text;
