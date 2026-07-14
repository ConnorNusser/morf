-- League scoring v2: points scale with pounds lifted (docs/leagues-v1-spec.md).
-- Adds week volume to get_league_week and per-session volume to
-- get_league_events. user_workouts.total_volume is always lbs (setVolumeLbs
-- client-side), so no unit conversion is needed.
--
-- Adding a column changes the functions' return shape, which CREATE OR REPLACE
-- refuses — drop the old definitions first (clients degrade to empty boards
-- for the instant between statements).
DROP FUNCTION IF EXISTS get_league_week(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_league_events(uuid, timestamptz, timestamptz);

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
  volume_lbs numeric,
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
           count(DISTINCT date(w.created_at))::integer AS active_days,
           coalesce(sum(w.total_volume), 0)::numeric AS volume_lbs
    FROM user_workouts w
    WHERE w.created_at >= p_week_start
      AND w.created_at < p_week_end
    GROUP BY w.user_id
  ),
  members AS (
    SELECT ws.user_id FROM week_sessions ws
    ORDER BY ws.sessions DESC
    LIMIT 100
  ),
  all_members AS (
    SELECT m.user_id FROM members m
    UNION
    SELECT p_user_id
  ),
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
         coalesce(ws.volume_lbs, 0) AS volume_lbs,
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

CREATE OR REPLACE FUNCTION get_league_events(
  p_user_id uuid,
  p_week_start timestamptz,
  p_week_end timestamptz
)
RETURNS TABLE (
  user_id uuid,
  username text,
  profile_picture_url text,
  is_friend boolean,
  kind text,
  occurred_at timestamptz,
  exercise_id text,
  gain_pct numeric,
  title text,
  volume_lbs numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH week_sessions AS (
    SELECT w.user_id, count(*) AS sessions
    FROM user_workouts w
    WHERE w.created_at >= p_week_start
      AND w.created_at < p_week_end
    GROUP BY w.user_id
  ),
  members AS (
    SELECT ws.user_id FROM week_sessions ws
    ORDER BY ws.sessions DESC
    LIMIT 100
  ),
  all_members AS (
    SELECT m.user_id FROM members m
    UNION
    SELECT p_user_id
  ),
  session_events AS (
    SELECT w.user_id,
           'session'::text AS kind,
           w.created_at AS occurred_at,
           NULL::text AS exercise_id,
           NULL::numeric AS gain_pct,
           w.title,
           coalesce(w.total_volume, 0)::numeric AS volume_lbs
    FROM user_workouts w
    JOIN all_members am ON am.user_id = w.user_id
    WHERE w.created_at >= p_week_start
      AND w.created_at < p_week_end
  ),
  week_top AS (
    SELECT DISTINCT ON (l.user_id, l.exercise_id)
           l.user_id, l.exercise_id, l.estimated_1rm AS week_best, l.recorded_at
    FROM user_lifts l
    JOIN all_members am ON am.user_id = l.user_id
    WHERE l.recorded_at >= p_week_start
      AND l.recorded_at < p_week_end
    ORDER BY l.user_id, l.exercise_id, l.estimated_1rm DESC, l.recorded_at ASC
  ),
  prior_bests AS (
    SELECT l.user_id, l.exercise_id, max(l.estimated_1rm) AS prior_best
    FROM user_lifts l
    JOIN (SELECT DISTINCT wt.user_id FROM week_top wt) wu ON wu.user_id = l.user_id
    WHERE l.recorded_at < p_week_start
    GROUP BY l.user_id, l.exercise_id
  ),
  pr_events AS (
    SELECT wt.user_id,
           'pr'::text AS kind,
           wt.recorded_at AS occurred_at,
           wt.exercise_id,
           round(((wt.week_best - pb.prior_best) / pb.prior_best * 100)::numeric, 1) AS gain_pct,
           NULL::text AS title,
           NULL::numeric AS volume_lbs
    FROM week_top wt
    JOIN prior_bests pb
      ON pb.user_id = wt.user_id AND pb.exercise_id = wt.exercise_id
    WHERE pb.prior_best > 0
      AND wt.week_best > pb.prior_best
  ),
  all_events AS (
    SELECT * FROM session_events
    UNION ALL
    SELECT * FROM pr_events
  )
  SELECT u.id AS user_id,
         u.username,
         u.profile_picture_url,
         (f.id IS NOT NULL) AS is_friend,
         e.kind,
         e.occurred_at,
         e.exercise_id,
         e.gain_pct,
         e.title,
         e.volume_lbs
  FROM all_events e
  JOIN users u ON u.id = e.user_id
  LEFT JOIN friends f ON f.user_id = p_user_id AND f.friend_id = e.user_id
  ORDER BY e.occurred_at ASC
  LIMIT 400;
$$;

GRANT EXECUTE ON FUNCTION get_league_week(uuid, timestamptz, timestamptz) TO anon;
GRANT EXECUTE ON FUNCTION get_league_events(uuid, timestamptz, timestamptz) TO anon;
