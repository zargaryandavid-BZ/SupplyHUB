-- Track when a partner first opens a dispatched request
alter table dispatches add column if not exists seen_at timestamptz default null;
