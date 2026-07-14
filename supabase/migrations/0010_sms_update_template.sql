-- Add SMS template for request-update notifications sent to partners.
alter table company_settings
  add column if not exists sms_update_template text;
