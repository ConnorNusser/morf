import type { FeedBackend } from './feedBackend';
import {
  FEED_POST_COLUMNS,
  FEED_WORKOUT_COLUMNS,
  FeedPostRow,
  FeedWorkoutRow,
  postMediaContentType,
  postMediaPath,
  toFeedPost,
  toFeedWorkout,
} from './feedRows';
import type { FeedComment, MediaInput, PostMedia } from './feedService';
import { supabase } from './supabase';

const MEDIA_BUCKET = 'post-media';

type FeedKind = 'workout' | 'post';

/**
 * Feed backend on Supabase (tables + RPCs from
 * supabase/migrations/017_feed_on_supabase.sql). Same surface and return
 * conventions as the self-hosted client in feedApi.ts, so FeedService can
 * swap between them on FEATURE_FLAGS.supabaseFeed.
 */
async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<{ data: T | null; error: string | null }> {
  if (!supabase) return { data: null, error: 'Supabase not configured' };
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`Feed RPC ${fn} failed:`, error.message);
    return { data: null, error: error.message };
  }
  return { data: data as T, error: null };
}

async function toggleLike(kind: FeedKind, id: string, userId: string, username: string, profilePictureUrl?: string) {
  return rpc<boolean>('feed_toggle_like', {
    p_kind: kind,
    p_id: id,
    p_user_id: userId,
    p_username: username,
    p_profile_picture_url: profilePictureUrl ?? null,
  });
}

async function addComment(
  kind: FeedKind,
  id: string,
  userId: string,
  username: string,
  profilePictureUrl: string | undefined,
  text: string
): Promise<FeedComment | null> {
  const { data } = await rpc<FeedComment>('feed_add_comment', {
    p_kind: kind,
    p_id: id,
    p_user_id: userId,
    p_username: username,
    p_profile_picture_url: profilePictureUrl ?? null,
    p_text: text,
  });
  return data;
}

async function deleteComment(kind: FeedKind, id: string, commentId: string, userId: string): Promise<boolean> {
  const { data } = await rpc<boolean>('feed_delete_comment', {
    p_kind: kind,
    p_id: id,
    p_comment_id: commentId,
    p_user_id: userId,
  });
  return data === true;
}

async function toggleCommentLike(
  kind: FeedKind,
  id: string,
  commentId: string,
  userId: string,
  username: string,
  profilePictureUrl?: string
): Promise<boolean> {
  // null = comment not found; true/false = liked/unliked, both successes.
  const { data, error } = await rpc<boolean | null>('feed_toggle_comment_like', {
    p_kind: kind,
    p_id: id,
    p_comment_id: commentId,
    p_user_id: userId,
    p_username: username,
    p_profile_picture_url: profilePictureUrl ?? null,
  });
  return !error && data !== null;
}

/** Uploads every attachment; on any failure removes what was uploaded and returns null. */
async function uploadPostMedia(userId: string, items: MediaInput[]): Promise<PostMedia[] | null> {
  if (!supabase) return null;
  const bucket = supabase.storage.from(MEDIA_BUCKET);
  const uploaded: string[] = [];
  const media: PostMedia[] = [];
  const now = Date.now();

  try {
    // Loaded lazily so node-side tests that import feedService don't pull native code.
    const { File } = await import('expo-file-system');
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const path = postMediaPath(userId, i, item.type, now);
      const bytes = await new File(item.uri).bytes();
      const { error } = await bucket.upload(path, bytes.buffer, {
        contentType: postMediaContentType(item.type),
      });
      if (error) throw new Error(error.message);
      uploaded.push(path);
      media.push({ url: bucket.getPublicUrl(path).data.publicUrl, type: item.type });
    }
    return media;
  } catch (error) {
    console.error('Post media upload failed:', error instanceof Error ? error.message : error);
    // Anon can't delete under the bucket policy; this is best-effort for
    // projects that allow it. Orphans are harmless (unreferenced).
    if (uploaded.length > 0) await bucket.remove(uploaded).catch(() => {});
    return null;
  }
}

export const feedSupabase: FeedBackend = {
  async getPosts(userId, limit = 20, offset = 0) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('feed_posts')
      .select(FEED_POST_COLUMNS)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error || !data) {
      if (error) console.error('Feed getPosts failed:', error.message);
      return [];
    }
    return (data as FeedPostRow[]).map(toFeedPost);
  },

  async createPost(userId, username, text, mediaItems, profilePictureUrl) {
    if (!supabase) return false;

    let media: PostMedia[] = [];
    if (mediaItems && mediaItems.length > 0) {
      const uploaded = await uploadPostMedia(userId, mediaItems);
      if (!uploaded) return false;
      media = uploaded;
    }

    const { error } = await supabase.from('feed_posts').insert({
      user_id: userId,
      username: username || '',
      profile_picture_url: profilePictureUrl ?? null,
      text: text || '',
      media,
    });
    if (error) console.error('createPost failed:', error.message);
    return !error;
  },

  async togglePostLike(postId, userId, username, profilePictureUrl) {
    const { data, error } = await toggleLike('post', postId, userId, username, profilePictureUrl);
    return { success: !error, liked: data === true };
  },

  addPostComment: (postId, userId, username, profilePictureUrl, text) =>
    addComment('post', postId, userId, username, profilePictureUrl, text),

  deletePostComment: (postId, commentId, userId) => deleteComment('post', postId, commentId, userId),

  togglePostCommentLike: (postId, commentId, userId, username, profilePictureUrl) =>
    toggleCommentLike('post', postId, commentId, userId, username, profilePictureUrl),

  async getWorkouts(userId, limit = 20, offset = 0) {
    if (!supabase) return [];
    const { data, error } = await supabase
      .from('feed_workouts')
      .select(FEED_WORKOUT_COLUMNS)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (error || !data) {
      if (error) console.error('Feed getWorkouts failed:', error.message);
      return [];
    }
    return (data as FeedWorkoutRow[]).map(toFeedWorkout);
  },

  async saveWorkout(userId, workout, username, profilePictureUrl, feedData) {
    if (!supabase) return false;
    const { error } = await supabase.from('feed_workouts').insert({
      // Same id scheme as the self-hosted server.
      id: `workout_${Date.now()}`,
      user_id: userId,
      username: username || '',
      profile_picture_url: profilePictureUrl ?? null,
      ...workout,
      total_distance_meters: workout.total_distance_meters ?? 0,
      total_cardio_seconds: workout.total_cardio_seconds ?? 0,
      feed_data: { likes: [], comments: [], ...(feedData ?? {}) },
    });
    if (error) console.error('saveWorkout failed:', error.message);
    return !error;
  },

  async toggleWorkoutLike(workoutId, userId, username, profilePictureUrl) {
    const { error } = await toggleLike('workout', workoutId, userId, username, profilePictureUrl);
    return !error;
  },

  addWorkoutComment: (workoutId, userId, username, profilePictureUrl, text) =>
    addComment('workout', workoutId, userId, username, profilePictureUrl, text),

  deleteWorkoutComment: (workoutId, commentId, userId) => deleteComment('workout', workoutId, commentId, userId),

  toggleWorkoutCommentLike: (workoutId, commentId, userId, username, profilePictureUrl) =>
    toggleCommentLike('workout', workoutId, commentId, userId, username, profilePictureUrl),
};
