-- Feed Posts Table
-- Allows users to create text + media posts in the social feed

-- Create feed_posts table
CREATE TABLE IF NOT EXISTS feed_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('video', 'image')),
  feed_data JSONB DEFAULT '{"likes": [], "comments": []}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_feed_posts_user_id ON feed_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON feed_posts(created_at DESC);

-- Disable RLS (app uses device-based auth, not Supabase Auth)
ALTER TABLE feed_posts DISABLE ROW LEVEL SECURITY;

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_feed_posts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS feed_posts_updated_at ON feed_posts;
CREATE TRIGGER feed_posts_updated_at
  BEFORE UPDATE ON feed_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_feed_posts_updated_at();

-- ============================================
-- Storage Bucket for Post Media
-- ============================================

-- Create storage bucket for post media (videos and images)
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-media', 'post-media', true)
ON CONFLICT (id) DO NOTHING;

-- Drop any existing policies for post-media bucket
DROP POLICY IF EXISTS "Post media is publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can update post media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete post media" ON storage.objects;

-- Policy: Anyone can view post media (public bucket)
CREATE POLICY "Post media is publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

-- Policy: Allow uploads to post-media bucket
CREATE POLICY "Users can upload post media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'post-media');

-- Policy: Allow updates to post-media
CREATE POLICY "Users can update post media"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'post-media');

-- Policy: Allow deletes from post-media
CREATE POLICY "Users can delete post media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'post-media');
