-- Add SMS portal invite template to company settings
alter table company_settings add column if not exists sms_invite_template text default null;
