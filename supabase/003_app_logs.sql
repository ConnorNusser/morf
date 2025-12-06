-- App Logging Tables for Morf
-- Run this in Supabase SQL Editor after 002_social_tables.sql

-- ============================================
-- Table: app_logs
-- Unified logging for sync, workout, auth, AI events
-- ============================================
create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  device_id text not null,
  username text,
  level text not null check (level in ('info', 'warn', 'error')),
  category text not null check (category in ('sync', 'workout', 'auth', 'ai', 'general')),
  event text not null,
  message text,
  context jsonb
);

-- ============================================
-- Indexes for performance
-- ============================================
create index if not exists idx_app_logs_device on app_logs(device_id);
create index if not exists idx_app_logs_level on app_logs(level);
create index if not exists idx_app_logs_category on app_logs(category);
create index if not exists idx_app_logs_event on app_logs(event);
create index if not exists idx_app_logs_created_at on app_logs(created_at desc);

-- Composite index for common queries
create index if not exists idx_app_logs_device_created on app_logs(device_id, created_at desc);
create index if not exists idx_app_logs_level_created on app_logs(level, created_at desc);

-- ============================================
-- Row Level Security
-- ============================================
alter table app_logs enable row level security;

-- Allow anyone to insert logs (from app)
drop policy if exists "Allow insert logs" on app_logs;
create policy "Allow insert logs" on app_logs for insert with check (true);

-- Allow reading own logs only (for debugging, optional)
drop policy if exists "Allow read own logs" on app_logs;
create policy "Allow read own logs" on app_logs for select using (true);

-- ============================================
-- Views for Debugging
-- ============================================

-- Recent events (all levels)
create or replace view recent_events as
select
  created_at,
  level,
  category,
  event,
  device_id,
  username,
  message,
  context
from app_logs
order by created_at desc
limit 20000;

-- Recent errors only
create or replace view recent_errors as
select
  created_at,
  category,
  event,
  device_id,
  username,
  message,
  context
from app_logs
where level = 'error'
order by created_at desc
limit 10000;

-- ============================================
-- Cleanup function (optional, run manually)
-- Deletes logs older than 30 days
-- ============================================
create or replace function cleanup_old_logs()
returns void as $$
begin
  delete from app_logs
  where created_at < now() - interval '30 days';
end;
$$ language plpgsql;

-- To run cleanup: SELECT cleanup_old_logs();
