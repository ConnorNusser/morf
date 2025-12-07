-- Cleanup script: Remove feed-related tables that are now on self-hosted server
-- Run this AFTER migrating data to the self-hosted server
--
-- IMPORTANT: Run `npm run migrate` on morf-server BEFORE running this script!
-- To also delete data during migration, run: `npm run migrate:delete`

-- ============================================
-- Step 1: Drop views that depend on tables
-- ============================================
DROP VIEW IF EXISTS recent_events CASCADE;
DROP VIEW IF EXISTS recent_errors CASCADE;
DROP VIEW IF EXISTS recent_workouts_feed CASCADE;

-- ============================================
-- Step 2: Drop functions
-- ============================================
DROP FUNCTION IF EXISTS cleanup_old_logs();

-- ============================================
-- Step 3: Drop tables (moved to self-hosted)
-- ============================================

-- Drop feed_posts table
DROP TABLE IF EXISTS feed_posts CASCADE;

-- Drop app_logs table
DROP TABLE IF EXISTS app_logs CASCADE;

-- Drop user_workouts table (feed data only)
-- Uncomment if user_workouts is ONLY used for feed and not for other analytics
-- DROP TABLE IF EXISTS user_workouts CASCADE;

-- ============================================
-- Step 4: Clean up storage bucket
-- ============================================
-- Run this in Supabase dashboard SQL editor if needed:
-- DELETE FROM storage.objects WHERE bucket_id = 'post-media';
-- DELETE FROM storage.buckets WHERE id = 'post-media';

-- ============================================
-- Tables that REMAIN on Supabase:
-- ============================================
-- users - User profiles, device_id mapping
-- friendships - Friend connections
-- user_lifts - Strength tracking data
-- user_percentiles - Rankings/leaderboards
-- workout_completions - Analytics (optional, could also move)
-- ai_usage - AI usage tracking (optional, could also move)
