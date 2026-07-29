-- Manager notification preferences
alter table company_settings
  add column if not exists notify_on_quote    boolean default true,
  add column if not exists notify_on_message  boolean default true,
  add column if not exists notify_channels    text    default 'email';  -- comma list: email,sms
