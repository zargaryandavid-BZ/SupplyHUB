-- Test/migration helpers.
-- reset_and_reseed() is only useful locally; update_sequences() is also called
-- by scripts/migrate-json-to-supabase.ts after importing existing data.

-- reset_and_reseed(): truncates every table, resets sequences, and re-inserts the seed.
-- Called in vitest beforeEach via supabase.rpc('reset_and_reseed').
create or replace function reset_and_reseed() returns void language plpgsql as $$
begin
  -- Truncate in reverse FK order; RESTART IDENTITY resets sequences to 1.
  truncate messages, quotes, dispatches, product_requests, orders, clients, partners
    restart identity cascade;

  -- Re-insert seed (same data as 0002_seed.sql but without OVERRIDING SYSTEM VALUE
  -- since sequences are now at 1 and rows are inserted in order).
  insert into clients (name, contact, email, phone) values
    ('Acme Publishing',  'Sara Miles',  'sara@acmepub.com',  '+1 202 555 0111'),
    ('Green Leaf Cafe',  'Tom Reyes',   'tom@greenleaf.com', '+1 202 555 0122'),
    ('TechStart Inc',    'Priya Shah',  'priya@techstart.io','+1 202 555 0133');

  insert into partners (company, contact, email, phone, categories, rating, active,
    location, preferred_channels, avg_delivery_days, website, logo_path,
    bank_name, bank_account, portal_contact_name, portal_email, products, created_at)
  values
    ('PrintPro Bindery','Alex Novak','alex@printpro.com','+1 312 555 0201',
     'books,hardcover,binding',4.6,1,'Chicago, US','email,whatsapp',14,
     'https://printpro.example.com',null,'First Chicago Bank','US00 0000 0000 0001',
     'Alex Novak','alex@printpro.com',
     '[{"name":"Hardcover Book A4","moq":500,"delivery_days":14,"price":12.5,"currency":"USD"},{"name":"Softcover Book A5","moq":1000,"delivery_days":10,"price":4.2,"currency":"USD"}]',
     now()::text),
    ('ColorMax Press','Dana Cole','dana@colormax.com','+1 312 555 0202',
     'brochures,flyers,posters,books',4.2,1,'Detroit, US','email,sms',10,
     'https://colormax.example.com',null,'Great Lakes Bank','US00 0000 0000 0002',
     'Dana Cole','dana@colormax.com',
     '[{"name":"Hardcover Book A4","moq":300,"delivery_days":12,"price":13.0,"currency":"USD"},{"name":"Tri-fold Brochure A4","moq":1000,"delivery_days":7,"price":0.35,"currency":"USD"}]',
     now()::text),
    ('BigFormat Co','Sam Ortiz','sam@bigformat.com','+1 312 555 0203',
     'banners,posters,signage',4.4,1,'Houston, US','phone,email',7,
     'https://bigformat.example.com',null,'Lone Star Credit Union','US00 0000 0000 0003',
     'Sam Ortiz','sam@bigformat.com',
     '[{"name":"Roll-up Banner 85x200","moq":5,"delivery_days":3,"price":45,"currency":"USD"},{"name":"Vinyl Banner","moq":1,"delivery_days":4,"price":30,"currency":"USD"}]',
     now()::text),
    ('EcoPack Solutions','Lena Fox','lena@ecopack.com','+1 312 555 0204',
     'packaging,boxes,labels',4.8,1,'Portland, US','email',12,
     'https://ecopack.example.com',null,'Pacific Coast Bank','US00 0000 0000 0004',
     'Lena Fox','lena@ecopack.com',
     '[{"name":"Mailer Box","moq":250,"delivery_days":10,"price":1.2,"currency":"USD"},{"name":"Product Label Sheet","moq":500,"delivery_days":6,"price":0.15,"currency":"USD"}]',
     now()::text);

  insert into orders (client_id, order_number, notes, created_at) values
    (1,'ORD-1001','Repeat customer, annual catalog',   now()::text),
    (2,'ORD-1002','New cafe menu launch',              now()::text),
    (3,'ORD-1003','Conference booth materials',        now()::text);

  insert into product_requests
    (order_id, title, category, specs, quantity, needed_by, hide_client, status, created_at,
     standard_size, width, height, size_unit, material, finishing, attachments)
  values
    (1,'5,000 Hardcover Books, A4','books',
     'A4, 200 pages, matte cover, sewn binding, full color',5000,'2026-08-15',1,'awarded',now()::text,
     'A4',null,null,null,null,'matte-lamination,sewn-binding',null),
    (2,'10,000 Tri-fold Brochures','brochures',
     'A4 tri-fold, 150gsm gloss, double sided, full color',10000,'2026-07-25',1,'quoting',now()::text,
     'A4',null,null,null,'150gsm gloss','gloss-lamination',null),
    (3,'50 Roll-up Banners','banners',
     '85x200cm, retractable stand included, single sided',50,'2026-07-30',1,'sent',now()::text,
     null,85,200,'cm',null,null,null);

  insert into dispatches (request_id, partner_id, sent_at) values
    (1,1,now()::text),(1,2,now()::text),
    (2,2,now()::text),(2,3,now()::text),
    (3,3,now()::text);

  insert into quotes
    (dispatch_id, price, currency, lead_time_days, valid_until, conditions, status, revision, created_at)
  values
    (1,12000,'USD',15,'2026-07-20','50% deposit, balance on delivery','won',1,now()::text),
    (2,13500,'USD',12,'2026-07-18','Full payment upfront for first order','lost',1,now()::text),
    (3,2200,'USD',7,'2026-07-15','Artwork must be print-ready PDF','submitted',1,now()::text);

  insert into messages (request_id, partner_id, author_role, text, created_at) values
    (1,1,'partner','Is the cover matte or gloss lamination?',now()::text),
    (1,1,'manager','Matte lamination, please.',             now()::text);
end;
$$;

-- update_sequences(): advances all identity sequences past the current max id.
-- Called by scripts/migrate-json-to-supabase.ts after bulk-inserting rows with explicit IDs.
create or replace function update_sequences() returns void language plpgsql as $$
begin
  perform setval(pg_get_serial_sequence('clients',          'id'), coalesce((select max(id) from clients),          0) + 1, false);
  perform setval(pg_get_serial_sequence('partners',         'id'), coalesce((select max(id) from partners),         0) + 1, false);
  perform setval(pg_get_serial_sequence('orders',           'id'), coalesce((select max(id) from orders),           0) + 1, false);
  perform setval(pg_get_serial_sequence('product_requests', 'id'), coalesce((select max(id) from product_requests), 0) + 1, false);
  perform setval(pg_get_serial_sequence('dispatches',       'id'), coalesce((select max(id) from dispatches),       0) + 1, false);
  perform setval(pg_get_serial_sequence('quotes',           'id'), coalesce((select max(id) from quotes),           0) + 1, false);
  perform setval(pg_get_serial_sequence('messages',         'id'), coalesce((select max(id) from messages),         0) + 1, false);
end;
$$;
