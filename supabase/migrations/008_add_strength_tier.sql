-- Migration: Add strength_tier to user_lifts for leaderboard display
-- This allows showing the user's tier (S+, A-, B, etc.) on the exercise leaderboard

-- Add strength_tier column to user_lifts table
ALTER TABLE user_lifts ADD COLUMN IF NOT EXISTS strength_tier TEXT;

-- Recreate views to include strength_tier
-- Must drop in reverse dependency order

DROP VIEW IF EXISTS exercise_leaderboard;
DROP VIEW IF EXISTS user_best_lifts;

-- Recreate user_best_lifts view with strength_tier
CREATE OR REPLACE VIEW user_best_lifts AS
SELECT DISTINCT ON (user_id, exercise_id)
  user_id,
  exercise_id,
  estimated_1rm,
  weight,
  reps,
  strength_tier,
  recorded_at
FROM user_lifts
ORDER BY user_id, exercise_id, estimated_1rm DESC;

-- Recreate exercise_leaderboard view with strength_tier
CREATE OR REPLACE VIEW exercise_leaderboard AS
SELECT
  u.id AS user_id,
  u.username,
  u.country_code,
  u.profile_picture_url,
  ubl.exercise_id,
  ubl.estimated_1rm,
  ubl.strength_tier,
  ubl.recorded_at,
  rank() OVER (PARTITION BY ubl.exercise_id ORDER BY ubl.estimated_1rm DESC) AS rank
FROM user_best_lifts ubl
JOIN users u ON u.id = ubl.user_id;
