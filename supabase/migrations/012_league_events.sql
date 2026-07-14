-- League week events (docs/leagues-v1-spec.md, Week Story view).
-- Raw chronological events for the viewer's week window: every session logged
-- and every PR set (best in-window e1RM beating the pre-window best). The
-- client replays these through the scoring rules to narrate the week
-- (lib/leagues/story.ts) — no points are computed here.

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
  kind text,               -- 'session' | 'pr'
  occurred_at timestamptz,
  exercise_id text,        -- pr only
  gain_pct numeric,        -- pr only
  title text               -- session only (workout title)
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
           w.title
    FROM user_workouts w
    JOIN all_members am ON am.user_id = w.user_id
    WHERE w.created_at >= p_week_start
      AND w.created_at < p_week_end
  ),
  week_top AS (
    -- The lift that set each member+exercise week-best, with when it happened.
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
           NULL::text AS title
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
         e.title
  FROM all_events e
  JOIN users u ON u.id = e.user_id
  LEFT JOIN friends f ON f.user_id = p_user_id AND f.friend_id = e.user_id
  ORDER BY e.occurred_at ASC
  LIMIT 400;
$$;

GRANT EXECUTE ON FUNCTION get_league_events(uuid, timestamptz, timestamptz) TO anon;
