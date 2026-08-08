-- SMS template when a client approves/declines a proposal (notifies manager)
alter table company_settings
  add column if not exists sms_client_response_template text;
