-- Workout Feed Enhancements
-- Run this in Supabase SQL Editor after 004_user_workouts.sql
-- Adds flexible feed_data column for strength level, PRs, etc.

-- ============================================
-- Add feed_data jsonb column to user_workouts
-- Structure: { "strength_level": "B+", "pr_count": 2, ... }
-- ============================================
alter table user_workouts add column if not exists feed_data jsonb not null default '{}'::jsonb;

-- ============================================
-- Update the recent_workouts_feed view to include feed_data
-- ============================================
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
  uw.exercises,
  uw.feed_data
from user_workouts uw
join users u on u.id = uw.user_id
order by uw.created_at desc
limit 50;
