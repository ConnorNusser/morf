-- Weekly league aggregates (docs/leagues-v1-spec.md).
-- One RPC returning raw per-member numbers for the viewer's week window; all
-- scoring happens client-side in lib/leagues/scoring.ts so point values can be
-- tuned without a migration.
--
-- Members = the caller + every user with a workout in the window (top 100 by
-- session count). is_friend marks the caller's friends (badge + push scoping).

CREATE OR REPLACE FUNCTION get_league_week(
  p_user_id uuid,
  p_week_start timestamptz,
  p_week_end timestamptz
)
RETURNS TABLE (
  user_id uuid,
  username text,
  profile_picture_url text,
  sessions integer,
  active_days integer,
  prs jsonb,
  new_lifts integer,
  is_friend boolean
)
LANGUAGE sql
STABLE
AS $$
  WITH week_sessions AS (
    SELECT w.user_id,
           count(*)::integer AS sessions,
           count(DISTINCT date(w.created_at))::integer AS active_days
    FROM user_workouts w
    WHERE w.created_at >= p_week_start
      AND w.created_at < p_week_end
    GROUP BY w.user_id
  ),
  members AS (
    -- Active users this week (payload guard: top 100 by sessions), plus the
    -- caller so their zero-week still returns a row for the You bar.
    SELECT ws.user_id FROM week_sessions ws
    ORDER BY ws.sessions DESC
    LIMIT 100
  ),
  all_members AS (
    SELECT m.user_id FROM members m
    UNION
    SELECT p_user_id
  ),
  -- Per member+exercise: best e1RM inside the window vs best before it.
  week_bests AS (
    SELECT l.user_id, l.exercise_id, max(l.estimated_1rm) AS week_best
    FROM user_lifts l
    JOIN all_members am ON am.user_id = l.user_id
    WHERE l.recorded_at >= p_week_start
      AND l.recorded_at < p_week_end
    GROUP BY l.user_id, l.exercise_id
  ),
  prior_bests AS (
    SELECT l.user_id, l.exercise_id, max(l.estimated_1rm) AS prior_best
    FROM user_lifts l
    JOIN (SELECT DISTINCT wb.user_id FROM week_bests wb) wu ON wu.user_id = l.user_id
    WHERE l.recorded_at < p_week_start
    GROUP BY l.user_id, l.exercise_id
  ),
  lift_movement AS (
    SELECT wb.user_id,
           wb.exercise_id,
           wb.week_best,
           pb.prior_best,
           CASE
             WHEN pb.prior_best IS NULL OR pb.prior_best <= 0 THEN NULL
             ELSE round(((wb.week_best - pb.prior_best) / pb.prior_best * 100)::numeric, 1)
           END AS gain_pct
    FROM week_bests wb
    LEFT JOIN prior_bests pb
      ON pb.user_id = wb.user_id AND pb.exercise_id = wb.exercise_id
  ),
  member_prs AS (
    -- PR = beat an existing prior best. Top 8 by gain per member (client caps
    -- scoring at 4; the extras feed the breakdown UI).
    SELECT lm.user_id,
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'exercise_id', lm.exercise_id,
                 'week_best', lm.week_best,
                 'prior_best', lm.prior_best,
                 'gain_pct', lm.gain_pct
               )
               ORDER BY lm.gain_pct DESC
             ) FILTER (WHERE lm.rn <= 8),
             '[]'::jsonb
           ) AS prs
    FROM (
      SELECT lm.*,
             row_number() OVER (PARTITION BY lm.user_id ORDER BY lm.gain_pct DESC) AS rn
      FROM lift_movement lm
      WHERE lm.gain_pct IS NOT NULL AND lm.week_best > lm.prior_best
    ) lm
    GROUP BY lm.user_id
  ),
  member_new_lifts AS (
    SELECT lm.user_id, count(*)::integer AS new_lifts
    FROM lift_movement lm
    WHERE lm.prior_best IS NULL
    GROUP BY lm.user_id
  )
  SELECT u.id AS user_id,
         u.username,
         u.profile_picture_url,
         coalesce(ws.sessions, 0) AS sessions,
         coalesce(ws.active_days, 0) AS active_days,
         coalesce(mp.prs, '[]'::jsonb) AS prs,
         coalesce(mnl.new_lifts, 0) AS new_lifts,
         (f.id IS NOT NULL) AS is_friend
  FROM all_members am
  JOIN users u ON u.id = am.user_id
  LEFT JOIN week_sessions ws ON ws.user_id = am.user_id
  LEFT JOIN member_prs mp ON mp.user_id = am.user_id
  LEFT JOIN member_new_lifts mnl ON mnl.user_id = am.user_id
  LEFT JOIN friends f ON f.user_id = p_user_id AND f.friend_id = am.user_id
  ORDER BY coalesce(ws.sessions, 0) DESC, u.username ASC;
$$;

GRANT EXECUTE ON FUNCTION get_league_week(uuid, timestamptz, timestamptz) TO anon;

-- The per-exercise max aggregations scan user_lifts by (user_id, recorded_at);
-- cover them (idempotent if an equivalent index already exists under this name).
CREATE INDEX IF NOT EXISTS idx_user_lifts_user_exercise_recorded
ON user_lifts (user_id, exercise_id, recorded_at);

CREATE INDEX IF NOT EXISTS idx_user_workouts_created_at
ON user_workouts (created_at);
