-- Adds a unique magic-link token per partner for portal access.
-- The token is generated on demand and stored here; /api/portal?token=<x> resolves it to a session.
alter table partners add column if not exists portal_token text unique;
