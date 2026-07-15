-- League PRs v2: two fixes to get_league_week's PR detection (docs/leagues-v1-spec.md).
--
-- 1. First-ever lifts count as PRs. 014 required a pre-week best
--    (prior_best IS NOT NULL AND > 0), so the first time an exercise was ever
--    logged it could never flag — while the in-app celebration counts exactly
--    that as a PR. Users saw "PR!" on the completion screen and nothing on the
--    league board. is_pr is now week_best > coalesce(prior_best, 0).
-- 2. PR lifts survive the top-6 cut. 014 kept only the 6 highest week-best
--    e1RMs per member, silently dropping genuine PRs on lighter accessories.
--    The jsonb list now keeps the top 6 PLUS any PR lift outside it.
--
-- gain_pct stays NULL for first-time lifts (no baseline to compare against).

DROP FUNCTION IF EXISTS get_league_week(uuid, timestamptz, timestamptz);

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
  top_lifts jsonb,
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
  -- Best set per member+exercise inside the week, carrying the stored tier.
  week_bests AS (
    SELECT DISTINCT ON (l.user_id, l.exercise_id)
           l.user_id, l.exercise_id, l.estimated_1rm AS week_best, l.strength_tier
    FROM user_lifts l
    JOIN all_members am ON am.user_id = l.user_id
    WHERE l.recorded_at >= p_week_start
      AND l.recorded_at < p_week_end
    ORDER BY l.user_id, l.exercise_id, l.estimated_1rm DESC
  ),
  prior_bests AS (
    SELECT l.user_id, l.exercise_id, max(l.estimated_1rm) AS prior_best
    FROM user_lifts l
    JOIN (SELECT DISTINCT wb.user_id FROM week_bests wb) wu ON wu.user_id = l.user_id
    WHERE l.recorded_at < p_week_start
    GROUP BY l.user_id, l.exercise_id
  ),
  member_top_lifts AS (
    SELECT t.user_id,
           coalesce(
             jsonb_agg(
               jsonb_build_object(
                 'exercise_id', t.exercise_id,
                 'week_best', t.week_best,
                 'prior_best', t.prior_best,
                 'gain_pct', t.gain_pct,
                 'strength_tier', t.strength_tier,
                 'is_pr', t.is_pr
               )
               ORDER BY t.week_best DESC
             ) FILTER (WHERE t.rn <= 6 OR t.is_pr),
             '[]'::jsonb
           ) AS top_lifts
    FROM (
      SELECT wb.user_id,
             wb.exercise_id,
             wb.week_best,
             pb.prior_best,
             CASE
               WHEN pb.prior_best IS NULL OR pb.prior_best <= 0 THEN NULL
               ELSE round(((wb.week_best - pb.prior_best) / pb.prior_best * 100)::numeric, 1)
             END AS gain_pct,
             wb.strength_tier,
             (wb.week_best > coalesce(pb.prior_best, 0)) AS is_pr,
             row_number() OVER (PARTITION BY wb.user_id ORDER BY wb.week_best DESC) AS rn
      FROM week_bests wb
      LEFT JOIN prior_bests pb
        ON pb.user_id = wb.user_id AND pb.exercise_id = wb.exercise_id
    ) t
    GROUP BY t.user_id
  )
  SELECT u.id AS user_id,
         u.username,
         u.profile_picture_url,
         coalesce(ws.sessions, 0) AS sessions,
         coalesce(ws.active_days, 0) AS active_days,
         coalesce(ws.volume_lbs, 0) AS volume_lbs,
         coalesce(mtl.top_lifts, '[]'::jsonb) AS top_lifts,
         (f.id IS NOT NULL) AS is_friend
  FROM all_members am
  JOIN users u ON u.id = am.user_id
  LEFT JOIN week_sessions ws ON ws.user_id = am.user_id
  LEFT JOIN member_top_lifts mtl ON mtl.user_id = am.user_id
  LEFT JOIN friends f ON f.user_id = p_user_id AND f.friend_id = am.user_id
  ORDER BY coalesce(ws.volume_lbs, 0) DESC, u.username ASC;
$$;

GRANT EXECUTE ON FUNCTION get_league_week(uuid, timestamptz, timestamptz) TO anon;
