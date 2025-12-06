-- Social Features Tables for Morf
-- Run this in Supabase SQL Editor after 001_analytics_tables.sql

-- ============================================
-- Table: users
-- Stores user identity (device_id + username + profile data)
-- ============================================
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  device_id text unique not null,
  username text unique not null,
  user_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration: Add user_data column if it doesn't exist (for existing tables)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'user_data'
  ) THEN
    ALTER TABLE users ADD COLUMN user_data jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Migration: Add country_code column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'country_code'
  ) THEN
    ALTER TABLE users ADD COLUMN country_code text;
  END IF;
END $$;

-- Migration: Add profile_picture_url column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'profile_picture_url'
  ) THEN
    ALTER TABLE users ADD COLUMN profile_picture_url text;
  END IF;
END $$;

-- ============================================
-- Table: friends
-- Stores friend relationships (one-way, add both directions for mutual)
-- ============================================
create table if not exists friends (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  friend_id uuid references users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(user_id, friend_id)
);

-- ============================================
-- Table: user_lifts
-- Synced lift data for leaderboard comparisons
-- ============================================
create table if not exists user_lifts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  exercise_id text not null,
  weight numeric not null,
  reps int not null,
  estimated_1rm numeric not null,
  recorded_at timestamptz not null,
  synced_at timestamptz default now()
);

-- ============================================
-- Table: user_percentiles
-- Stores overall strength percentile data for leaderboard
-- ============================================
create table if not exists user_percentiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade unique,
  overall_percentile numeric not null default 0,
  strength_level text not null default 'Beginner',
  muscle_groups jsonb default '{}'::jsonb,
  -- Structure: { "chest": 45, "back": 52, "shoulders": 38, "arms": 41, "legs": 55, "glutes": 30 }
  top_contributions jsonb default '[]'::jsonb,
  -- Structure: [{ "exercise_id": "bench-press", "name": "Bench Press", "percentile": 65 }, ...]
  updated_at timestamptz default now()
);

-- ============================================
-- Indexes for performance
-- ============================================
create index if not exists idx_users_username on users(username);
create index if not exists idx_users_device_id on users(device_id);
create index if not exists idx_users_country_code on users(country_code);
create index if not exists idx_user_percentiles_user on user_percentiles(user_id);
create index if not exists idx_user_percentiles_overall on user_percentiles(overall_percentile desc);
create index if not exists idx_friends_user on friends(user_id);
create index if not exists idx_friends_friend on friends(friend_id);
create index if not exists idx_user_lifts_user on user_lifts(user_id);
create index if not exists idx_user_lifts_exercise on user_lifts(exercise_id);
create index if not exists idx_user_lifts_user_exercise on user_lifts(user_id, exercise_id);

-- ============================================
-- Row Level Security
-- ============================================
alter table users enable row level security;
alter table friends enable row level security;
alter table user_lifts enable row level security;
alter table user_percentiles enable row level security;

-- Users policies (public read, authenticated write)
drop policy if exists "Anyone can read users" on users;
drop policy if exists "Anyone can insert users" on users;
drop policy if exists "Anyone can update users" on users;
create policy "Anyone can read users" on users for select using (true);
create policy "Anyone can insert users" on users for insert with check (true);
create policy "Anyone can update users" on users for update using (true);

-- Friends policies
drop policy if exists "Anyone can read friends" on friends;
drop policy if exists "Anyone can insert friends" on friends;
drop policy if exists "Anyone can delete friends" on friends;
create policy "Anyone can read friends" on friends for select using (true);
create policy "Anyone can insert friends" on friends for insert with check (true);
create policy "Anyone can delete friends" on friends for delete using (true);

-- User lifts policies
drop policy if exists "Anyone can read lifts" on user_lifts;
drop policy if exists "Anyone can insert lifts" on user_lifts;
drop policy if exists "Anyone can update lifts" on user_lifts;
create policy "Anyone can read lifts" on user_lifts for select using (true);
create policy "Anyone can insert lifts" on user_lifts for insert with check (true);
create policy "Anyone can update lifts" on user_lifts for update using (true);

-- User percentiles policies
drop policy if exists "Anyone can read percentiles" on user_percentiles;
drop policy if exists "Anyone can insert percentiles" on user_percentiles;
drop policy if exists "Anyone can update percentiles" on user_percentiles;
create policy "Anyone can read percentiles" on user_percentiles for select using (true);
create policy "Anyone can insert percentiles" on user_percentiles for insert with check (true);
create policy "Anyone can update percentiles" on user_percentiles for update using (true);

-- ============================================
-- Useful Views
-- ============================================

-- Get user with their best lift per exercise
create or replace view user_best_lifts as
select distinct on (user_id, exercise_id)
  user_id,
  exercise_id,
  estimated_1rm,
  weight,
  reps,
  recorded_at
from user_lifts
order by user_id, exercise_id, estimated_1rm desc;

-- Drop and recreate views to add profile_picture_url column
DROP VIEW IF EXISTS exercise_leaderboard CASCADE;
DROP VIEW IF EXISTS overall_leaderboard CASCADE;

-- Leaderboard view (top lifters per exercise)
create or replace view exercise_leaderboard as
select
  u.id as user_id,
  u.username,
  u.country_code,
  u.profile_picture_url,
  ubl.exercise_id,
  ubl.estimated_1rm,
  ubl.recorded_at,
  rank() over (partition by ubl.exercise_id order by ubl.estimated_1rm desc) as rank
from user_best_lifts ubl
join users u on u.id = ubl.user_id;

-- Overall strength leaderboard view
create or replace view overall_leaderboard as
select
  u.id as user_id,
  u.username,
  u.country_code,
  u.profile_picture_url,
  up.overall_percentile,
  up.strength_level,
  up.muscle_groups,
  up.top_contributions,
  up.updated_at,
  rank() over (order by up.overall_percentile desc) as rank
from user_percentiles up
join users u on u.id = up.user_id
where up.overall_percentile > 0;

-- ============================================
-- Function to get leaderboard for a user's friends
-- ============================================
-- Drop the function first to change return type
DROP FUNCTION IF EXISTS get_friend_leaderboard(uuid, text[]);

create or replace function get_friend_leaderboard(p_user_id uuid, p_exercise_ids text[])
returns table (
  user_id uuid,
  username text,
  profile_picture_url text,
  exercise_id text,
  estimated_1rm numeric,
  recorded_at timestamptz,
  rank bigint
) as $$
begin
  return query
  select
    el.user_id,
    el.username,
    el.profile_picture_url,
    el.exercise_id,
    el.estimated_1rm,
    el.recorded_at,
    row_number() over (partition by el.exercise_id order by el.estimated_1rm desc)::bigint as rank
  from exercise_leaderboard el
  where (
    el.user_id = p_user_id
    or el.user_id in (select f.friend_id from friends f where f.user_id = p_user_id)
  )
  and el.exercise_id = any(p_exercise_ids);
end;
$$ language plpgsql;

-- ============================================
-- Storage Bucket for Profile Pictures
-- ============================================
-- Create the bucket if it doesn't exist
insert into storage.buckets (id, name, public)
values ('profile-pictures', 'profile-pictures', true)
on conflict (id) do nothing;

-- Drop existing policies if any
drop policy if exists "Allow public read" on storage.objects;
drop policy if exists "Allow uploads" on storage.objects;
drop policy if exists "Allow updates" on storage.objects;
drop policy if exists "Allow deletes" on storage.objects;

-- Allow anyone to read (public bucket)
create policy "Allow public read"
on storage.objects for select
using (bucket_id = 'profile-pictures');

-- Allow anyone to upload
create policy "Allow uploads"
on storage.objects for insert
with check (bucket_id = 'profile-pictures');

-- Allow anyone to update (overwrite their picture)
create policy "Allow updates"
on storage.objects for update
using (bucket_id = 'profile-pictures');

-- Allow anyone to delete
create policy "Allow deletes"
on storage.objects for delete
using (bucket_id = 'profile-pictures');
