-- Store individual SKU entries: [{sku: "SKU-001", qty: 1000}, ...]
alter table product_requests
  add column if not exists sku_items jsonb default null;
