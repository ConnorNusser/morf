-- Migration: Add cardio tracking columns to user_workouts
-- These columns support distance and duration tracking for cardio exercises

-- Add total_distance_meters column (for running, cycling, etc.)
ALTER TABLE user_workouts
ADD COLUMN IF NOT EXISTS total_distance_meters INTEGER DEFAULT 0;

-- Add total_cardio_seconds column (for cardio exercise duration)
ALTER TABLE user_workouts
ADD COLUMN IF NOT EXISTS total_cardio_seconds INTEGER DEFAULT 0;
