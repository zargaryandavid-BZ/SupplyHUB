-- OTP-based auth sessions.
-- Each row starts as a pending OTP challenge and becomes a verified session.
create table if not exists auth_sessions (
  id           text primary key,           -- random UUID stored in cookie
  actor_type   text not null,              -- 'manager' | 'partner'
  actor_id     integer,                    -- partner id; null for manager
  otp_hash     text,                       -- SHA-256 of 6-digit code (cleared after verify)
  otp_expires  timestamptz,               -- OTP valid 10 min
  verified     boolean not null default false,
  last_active  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);

-- Clean up expired unverified sessions automatically (run via cron or on-demand).
-- Index for fast cookie lookups.
create index if not exists auth_sessions_id_verified on auth_sessions (id, verified);
