-- Editable SMS notification templates (manager Settings).
alter table company_settings
  add column if not exists sms_new_request_template text,
  add column if not exists sms_won_template text;
