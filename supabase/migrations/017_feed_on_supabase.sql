-- Feed back on Supabase.
-- Replaces the self-hosted feed server (feed.morf.fyi) for workout posts,
-- text/media posts, likes, comments and app logs. The client picks the
-- backend with FEATURE_FLAGS.supabaseFeed (lib/config/featureFlags.ts).
--
-- Tables mirror the self-hosted schema (morph-server/init.sql) so rows copy
-- across 1:1 (scripts/migrate-feed-to-supabase.mjs). Likes and comments stay
-- inline in feed_data JSONB, as on the server.
--
-- Writes to likes/comments go through SECURITY DEFINER RPCs that lock the row,
-- so two people liking at once can't overwrite each other (the server's
-- read-modify-write could). Anon can read and insert; it can't UPDATE/DELETE
-- rows directly.
--
-- Named feed_workouts (not user_workouts) because user_workouts already exists
-- here for leagues/analytics with a different shape.

-- ============================================
-- Tables
-- ============================================

CREATE TABLE IF NOT EXISTS feed_workouts (
  id TEXT PRIMARY KEY DEFAULT ('workout_' || (extract(epoch FROM now()) * 1000)::bigint),
  user_id UUID NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  profile_picture_url TEXT,
  title TEXT NOT NULL,
  duration_seconds INTEGER,
  exercise_count INTEGER,
  set_count INTEGER,
  total_volume REAL,
  total_distance_meters REAL DEFAULT 0,
  total_cardio_seconds INTEGER DEFAULT 0,
  exercises JSONB DEFAULT '[]'::jsonb,
  feed_data JSONB DEFAULT '{"likes": [], "comments": []}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_workouts_user_id ON feed_workouts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_workouts_created_at ON feed_workouts(created_at DESC);

-- feed_posts was dropped by 007_cleanup_feed_tables.sql; recreated with the
-- self-hosted shape (media array, denormalized username). TEXT id so migrated
-- uuids and new ones share a column type with feed_workouts.
CREATE TABLE IF NOT EXISTS feed_posts (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id UUID NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  profile_picture_url TEXT,
  text TEXT NOT NULL DEFAULT '',
  media JSONB DEFAULT '[]'::jsonb,  -- [{url, type}] with absolute public URLs
  feed_data JSONB DEFAULT '{"likes": [], "comments": []}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);

CREATE TABLE IF NOT EXISTS app_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  device_id TEXT NOT NULL,
  username TEXT,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  category TEXT NOT NULL CHECK (category IN ('sync', 'workout', 'auth', 'ai', 'general')),
  event TEXT NOT NULL,
  message TEXT,
  context JSONB
);

CREATE INDEX IF NOT EXISTS idx_app_logs_device_created ON app_logs(device_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_logs_level ON app_logs(level);
CREATE INDEX IF NOT EXISTS idx_app_logs_created_at ON app_logs(created_at DESC);

CREATE OR REPLACE FUNCTION update_feed_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feed_posts_updated_at ON feed_posts;
CREATE TRIGGER feed_posts_updated_at
  BEFORE UPDATE ON feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_feed_posts_updated_at();

-- ============================================
-- Row Level Security: read + insert only
-- ============================================

ALTER TABLE feed_workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_workouts readable" ON feed_workouts;
DROP POLICY IF EXISTS "feed_workouts insertable" ON feed_workouts;
CREATE POLICY "feed_workouts readable" ON feed_workouts FOR SELECT USING (true);
CREATE POLICY "feed_workouts insertable" ON feed_workouts FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "feed_posts readable" ON feed_posts;
DROP POLICY IF EXISTS "feed_posts insertable" ON feed_posts;
CREATE POLICY "feed_posts readable" ON feed_posts FOR SELECT USING (true);
CREATE POLICY "feed_posts insertable" ON feed_posts FOR INSERT WITH CHECK (true);

-- Logs are write-only from the client.
DROP POLICY IF EXISTS "app_logs insertable" ON app_logs;
CREATE POLICY "app_logs insertable" ON app_logs FOR INSERT WITH CHECK (true);

-- ============================================
-- Like / comment RPCs
-- ============================================
-- p_kind is 'workout' or 'post'. Identity is the caller-supplied user id, the
-- same trust model as the self-hosted server's x-user-id header (no auth).

CREATE OR REPLACE FUNCTION feed_table(p_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_kind
    WHEN 'workout' THEN 'feed_workouts'
    WHEN 'post' THEN 'feed_posts'
  END
$$;

-- Locks the row and returns its feed_data (normalized to have both arrays).
CREATE OR REPLACE FUNCTION feed_lock_item(p_kind text, p_id text, OUT o_table text, OUT o_feed_data jsonb, OUT o_owner uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  o_table := feed_table(p_kind);
  IF o_table IS NULL THEN
    RAISE EXCEPTION 'unknown feed kind: %', p_kind;
  END IF;

  EXECUTE format('SELECT feed_data, user_id FROM %I WHERE id = $1 FOR UPDATE', o_table)
    INTO o_feed_data, o_owner
    USING p_id;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'feed item not found: % %', p_kind, p_id USING ERRCODE = 'no_data_found';
  END IF;

  o_feed_data := coalesce(o_feed_data, '{}'::jsonb);
  o_feed_data := jsonb_set(o_feed_data, '{likes}', coalesce(o_feed_data->'likes', '[]'::jsonb));
  o_feed_data := jsonb_set(o_feed_data, '{comments}', coalesce(o_feed_data->'comments', '[]'::jsonb));
END;
$$;

-- Adds or removes p_user_id from a likes array. Returns the new array and
-- whether the user now likes it.
CREATE OR REPLACE FUNCTION feed_toggle_in(p_likes jsonb, p_user_id uuid, p_username text, p_profile_picture_url text, OUT o_likes jsonb, OUT o_liked boolean)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  p_likes := coalesce(p_likes, '[]'::jsonb);
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_likes) e WHERE e->>'user_id' = p_user_id::text) THEN
    SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb)
      INTO o_likes
      FROM jsonb_array_elements(p_likes) WITH ORDINALITY AS x(e, ord)
      WHERE e->>'user_id' <> p_user_id::text;
    o_liked := false;
  ELSE
    o_likes := p_likes || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'user_id', p_user_id,
      'username', coalesce(p_username, ''),
      'profile_picture_url', p_profile_picture_url,
      'created_at', now()
    )));
    o_liked := true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION feed_toggle_like(
  p_kind text,
  p_id text,
  p_user_id uuid,
  p_username text,
  p_profile_picture_url text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  t record;
BEGIN
  SELECT * INTO item FROM feed_lock_item(p_kind, p_id);
  SELECT * INTO t FROM feed_toggle_in(item.o_feed_data->'likes', p_user_id, p_username, p_profile_picture_url);

  EXECUTE format('UPDATE %I SET feed_data = $1 WHERE id = $2', item.o_table)
    USING jsonb_set(item.o_feed_data, '{likes}', t.o_likes), p_id;

  RETURN t.o_liked;
END;
$$;

CREATE OR REPLACE FUNCTION feed_add_comment(
  p_kind text,
  p_id text,
  p_user_id uuid,
  p_username text,
  p_profile_picture_url text,
  p_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  comment jsonb;
BEGIN
  IF p_text IS NULL OR btrim(p_text) = '' THEN
    RAISE EXCEPTION 'comment text required';
  END IF;

  SELECT * INTO item FROM feed_lock_item(p_kind, p_id);

  comment := jsonb_strip_nulls(jsonb_build_object(
    'id', gen_random_uuid(),
    'user_id', p_user_id,
    'username', coalesce(p_username, ''),
    'profile_picture_url', p_profile_picture_url,
    'text', p_text,
    'created_at', now()
  ));

  EXECUTE format('UPDATE %I SET feed_data = $1 WHERE id = $2', item.o_table)
    USING jsonb_set(item.o_feed_data, '{comments}', (item.o_feed_data->'comments') || jsonb_build_array(comment)), p_id;

  RETURN comment;
END;
$$;

-- The comment's author or the item's owner may delete. Returns false if the
-- comment is missing or the caller isn't allowed.
CREATE OR REPLACE FUNCTION feed_delete_comment(
  p_kind text,
  p_id text,
  p_comment_id text,
  p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  target jsonb;
  remaining jsonb;
BEGIN
  SELECT * INTO item FROM feed_lock_item(p_kind, p_id);

  SELECT e INTO target
    FROM jsonb_array_elements(item.o_feed_data->'comments') e
    WHERE e->>'id' = p_comment_id
    LIMIT 1;

  IF target IS NULL THEN
    RETURN false;
  END IF;
  IF target->>'user_id' <> p_user_id::text AND item.o_owner <> p_user_id THEN
    RETURN false;
  END IF;

  SELECT coalesce(jsonb_agg(e ORDER BY ord), '[]'::jsonb)
    INTO remaining
    FROM jsonb_array_elements(item.o_feed_data->'comments') WITH ORDINALITY AS x(e, ord)
    WHERE e->>'id' <> p_comment_id;

  EXECUTE format('UPDATE %I SET feed_data = $1 WHERE id = $2', item.o_table)
    USING jsonb_set(item.o_feed_data, '{comments}', remaining), p_id;

  RETURN true;
END;
$$;

-- Toggles a like on a single comment. Returns null if the comment is missing,
-- otherwise whether the user now likes it.
CREATE OR REPLACE FUNCTION feed_toggle_comment_like(
  p_kind text,
  p_id text,
  p_comment_id text,
  p_user_id uuid,
  p_username text,
  p_profile_picture_url text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  item record;
  target jsonb;
  t record;
  updated jsonb;
BEGIN
  SELECT * INTO item FROM feed_lock_item(p_kind, p_id);

  SELECT e INTO target
    FROM jsonb_array_elements(item.o_feed_data->'comments') e
    WHERE e->>'id' = p_comment_id
    LIMIT 1;

  IF target IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO t FROM feed_toggle_in(target->'likes', p_user_id, p_username, p_profile_picture_url);

  SELECT jsonb_agg(
           CASE WHEN e->>'id' = p_comment_id THEN jsonb_set(e, '{likes}', t.o_likes) ELSE e END
           ORDER BY ord)
    INTO updated
    FROM jsonb_array_elements(item.o_feed_data->'comments') WITH ORDINALITY AS x(e, ord);

  EXECUTE format('UPDATE %I SET feed_data = $1 WHERE id = $2', item.o_table)
    USING jsonb_set(item.o_feed_data, '{comments}', updated), p_id;

  RETURN t.o_liked;
END;
$$;

-- Internal helper; only the RPCs above call it.
REVOKE EXECUTE ON FUNCTION feed_lock_item(text, text) FROM PUBLIC, anon, authenticated;

-- ============================================
-- Storage: post media
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'post-media', 'post-media', true, 52428800,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Post media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload post media" ON storage.objects;
CREATE POLICY "Post media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');
CREATE POLICY "Anyone can upload post media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media');
