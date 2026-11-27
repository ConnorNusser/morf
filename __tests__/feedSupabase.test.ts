import { parseFlag } from '@/lib/config/featureFlags';
import {
  FeedPostRow,
  FeedWorkoutRow,
  postMediaContentType,
  postMediaPath,
  toFeedPost,
  toFeedWorkout,
} from '@/lib/services/feedRows';

describe('parseFlag', () => {
  it('uses the fallback when unset or unrecognized', () => {
    expect(parseFlag(undefined, true)).toBe(true);
    expect(parseFlag(undefined, false)).toBe(false);
    expect(parseFlag('maybe', true)).toBe(true);
  });

  it('reads true/false spellings, case- and space-insensitive', () => {
    expect(parseFlag(' FALSE ', true)).toBe(false);
    expect(parseFlag('0', true)).toBe(false);
    expect(parseFlag('off', true)).toBe(false);
    expect(parseFlag('True', false)).toBe(true);
    expect(parseFlag('1', false)).toBe(true);
    expect(parseFlag('on', false)).toBe(true);
  });
});

describe('toFeedWorkout', () => {
  const row: FeedWorkoutRow = {
    id: 'workout_1',
    user_id: 'u1',
    username: 'connor',
    profile_picture_url: null,
    title: 'Push',
    duration_seconds: 3600,
    exercise_count: 2,
    set_count: 8,
    total_volume: 12000,
    total_distance_meters: null,
    total_cardio_seconds: null,
    exercises: [{ name: 'Bench Press', sets: 4, bestSet: '235 x 1' }],
    feed_data: { likes: [], comments: [], pr_count: 1 },
    created_at: '2026-11-26T12:00:00.000Z',
  };

  it('maps a row, turning nulls into undefined and the timestamp into a Date', () => {
    const w = toFeedWorkout(row);
    expect(w.created_at).toEqual(new Date('2026-11-26T12:00:00.000Z'));
    expect(w.profile_picture_url).toBeUndefined();
    expect(w.total_distance_meters).toBeUndefined();
    expect(w.feed_data?.pr_count).toBe(1);
    expect(w.exercises).toHaveLength(1);
  });

  it('defaults missing counts, exercises and username', () => {
    const w = toFeedWorkout({ ...row, exercises: null, set_count: null, username: null, feed_data: null });
    expect(w.exercises).toEqual([]);
    expect(w.set_count).toBe(0);
    expect(w.username).toBe('');
    expect(w.feed_data).toBeUndefined();
  });
});

describe('toFeedPost', () => {
  const row: FeedPostRow = {
    id: 'p1',
    user_id: 'u1',
    username: 'connor',
    profile_picture_url: 'https://x/p.jpg',
    text: 'hi',
    media: [],
    feed_data: null,
    created_at: '2026-11-26T12:00:00.000Z',
  };

  it('leaves media undefined when there are no attachments', () => {
    expect(toFeedPost(row).media).toBeUndefined();
    expect(toFeedPost({ ...row, media: null }).media).toBeUndefined();
  });

  it('passes absolute media URLs through untouched', () => {
    const media = [{ url: 'https://proj.supabase.co/storage/v1/object/public/post-media/u1/1-0.jpg', type: 'image' as const }];
    expect(toFeedPost({ ...row, media }).media).toEqual(media);
  });
});

describe('post media paths', () => {
  it('namespaces by user and picks the extension and content type from the media type', () => {
    expect(postMediaPath('u1', 0, 'image', 123)).toBe('u1/123-0.jpg');
    expect(postMediaPath('u1', 2, 'video', 123)).toBe('u1/123-2.mp4');
    expect(postMediaContentType('video')).toBe('video/mp4');
    expect(postMediaContentType('image')).toBe('image/jpeg');
  });
});
