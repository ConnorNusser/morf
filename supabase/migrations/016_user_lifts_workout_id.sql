-- Tie each synced lift to the workout it came from, so deleting a workout can
-- remove its lifts too.
--
-- user_lifts rows carried no workout reference: deleting a session removed its
-- user_workouts row (volume) but left its lifts behind, so a deleted — typically
-- mistyped — set kept paying league PR points for the rest of the week
-- (get_league_week reads week_best/prior_best from user_lifts) and stood as the
-- all-time best on the lift leaderboards, blocking every later real PR.
--
-- Rows synced before this migration keep workout_id NULL and are untouched.
-- Text, not a foreign key: user_workouts.id is the local workout id, and the
-- lift insert can land before the workout upsert.

ALTER TABLE user_lifts ADD COLUMN IF NOT EXISTS workout_id text;

CREATE INDEX IF NOT EXISTS idx_user_lifts_workout_id
  ON user_lifts(workout_id)
  WHERE workout_id IS NOT NULL;

-- user_lifts had select/insert/update policies only; the client needs delete.
DROP POLICY IF EXISTS "Anyone can delete lifts" ON user_lifts;
CREATE POLICY "Anyone can delete lifts" ON user_lifts FOR DELETE USING (true);
