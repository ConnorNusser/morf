-- User Workouts Table for Morf
-- Run this in Supabase SQL Editor after 003_app_logs.sql
-- Stores workout summaries for social profile viewing

-- ============================================
-- Table: user_workouts
-- Stores workout summaries synced from the app
-- ============================================
create table if not exists user_workouts (
  id text primary key,  -- Matches local workout ID
  user_id uuid references users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null,
  duration_seconds int not null default 0,
  exercise_count int not null default 0,
  set_count int not null default 0,
  total_volume numeric not null default 0,  -- Total weight lifted in lbs
  exercises jsonb not null default '[]'::jsonb,
  -- Structure: [{ "name": "Bench Press", "sets": 3, "bestSet": "185x8", "isPR": true }]
  synced_at timestamptz default now()
);

-- ============================================
-- Indexes for performance
-- ============================================
create index if not exists idx_user_workouts_user on user_workouts(user_id);
create index if not exists idx_user_workouts_created on user_workouts(created_at desc);
create index if not exists idx_user_workouts_user_created on user_workouts(user_id, created_at desc);

-- ============================================
-- Row Level Security
-- ============================================
alter table user_workouts enable row level security;

-- Anyone can read workouts (for social profiles)
drop policy if exists "Anyone can read workouts" on user_workouts;
create policy "Anyone can read workouts" on user_workouts for select using (true);

-- Anyone can insert their workouts
drop policy if exists "Anyone can insert workouts" on user_workouts;
create policy "Anyone can insert workouts" on user_workouts for insert with check (true);

-- Anyone can update their workouts (for re-sync)
drop policy if exists "Anyone can update workouts" on user_workouts;
create policy "Anyone can update workouts" on user_workouts for update using (true);

-- Anyone can delete their workouts
drop policy if exists "Anyone can delete workouts" on user_workouts;
create policy "Anyone can delete workouts" on user_workouts for delete using (true);

-- ============================================
-- Useful Views
-- ============================================

-- Recent workouts feed (for social/discovery)
create or replace view recent_workouts_feed as
select
  uw.id,
  uw.user_id,
  u.username,
  u.profile_picture_url,
  uw.title,
  uw.created_at,
  uw.duration_seconds,
  uw.exercise_count,
  uw.set_count,
  uw.total_volume,
  uw.exercises
from user_workouts uw
join users u on u.id = uw.user_id
order by uw.created_at desc
limit 50;

-- User workout stats
create or replace view user_workout_stats as
select
  user_id,
  count(*) as total_workouts,
  sum(duration_seconds) as total_duration_seconds,
  sum(total_volume) as total_volume_lifted,
  sum(set_count) as total_sets,
  avg(duration_seconds)::int as avg_workout_duration,
  max(created_at) as last_workout_at
from user_workouts
group by user_id;

-- ============================================
-- Function to get a user's recent workouts
-- ============================================
create or replace function get_user_workouts(p_user_id uuid, p_limit int default 10)
returns table (
  id text,
  title text,
  created_at timestamptz,
  duration_seconds int,
  exercise_count int,
  set_count int,
  total_volume numeric,
  exercises jsonb
) as $$
begin
  return query
  select
    uw.id,
    uw.title,
    uw.created_at,
    uw.duration_seconds,
    uw.exercise_count,
    uw.set_count,
    uw.total_volume,
    uw.exercises
  from user_workouts uw
  where uw.user_id = p_user_id
  order by uw.created_at desc
  limit p_limit;
end;
$$ language plpgsql;
