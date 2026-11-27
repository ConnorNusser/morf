import type {
  FeedPost,
  FeedWorkout,
  PostFeedData,
  PostMedia,
  WorkoutExerciseSummary,
  WorkoutFeedData,
} from './feedService';

/** Row shape of `feed_workouts` (supabase/migrations/017_feed_on_supabase.sql). */
export interface FeedWorkoutRow {
  id: string;
  user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  title: string;
  duration_seconds: number | null;
  exercise_count: number | null;
  set_count: number | null;
  total_volume: number | null;
  total_distance_meters: number | null;
  total_cardio_seconds: number | null;
  exercises: WorkoutExerciseSummary[] | null;
  feed_data: WorkoutFeedData | null;
  created_at: string;
}

/** Row shape of `feed_posts`. Media URLs are absolute public Storage URLs. */
export interface FeedPostRow {
  id: string;
  user_id: string;
  username: string | null;
  profile_picture_url: string | null;
  text: string | null;
  media: PostMedia[] | null;
  feed_data: PostFeedData | null;
  created_at: string;
}

export const FEED_WORKOUT_COLUMNS =
  'id, user_id, username, profile_picture_url, title, duration_seconds, exercise_count, set_count, total_volume, total_distance_meters, total_cardio_seconds, exercises, feed_data, created_at';

export const FEED_POST_COLUMNS =
  'id, user_id, username, profile_picture_url, text, media, feed_data, created_at';

const orUndef = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

export function toFeedWorkout(row: FeedWorkoutRow): FeedWorkout {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    created_at: new Date(row.created_at),
    duration_seconds: row.duration_seconds ?? 0,
    exercise_count: row.exercise_count ?? 0,
    set_count: row.set_count ?? 0,
    total_volume: row.total_volume ?? 0,
    total_distance_meters: orUndef(row.total_distance_meters),
    total_cardio_seconds: orUndef(row.total_cardio_seconds),
    exercises: row.exercises ?? [],
    feed_data: orUndef(row.feed_data),
    username: row.username ?? '',
    profile_picture_url: orUndef(row.profile_picture_url),
  };
}

export function toFeedPost(row: FeedPostRow): FeedPost {
  const media = row.media ?? [];
  return {
    id: row.id,
    user_id: row.user_id,
    text: row.text ?? '',
    media: media.length > 0 ? media : undefined,
    created_at: new Date(row.created_at),
    feed_data: orUndef(row.feed_data),
    username: row.username ?? '',
    profile_picture_url: orUndef(row.profile_picture_url),
  };
}

/** Storage object path for one uploaded post attachment: `<userId>/<ts>-<i>.<ext>`. */
export function postMediaPath(userId: string, index: number, type: 'video' | 'image', now: number = Date.now()): string {
  return `${userId}/${now}-${index}.${type === 'video' ? 'mp4' : 'jpg'}`;
}

export function postMediaContentType(type: 'video' | 'image'): string {
  return type === 'video' ? 'video/mp4' : 'image/jpeg';
}
