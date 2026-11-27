/**
 * Build-time feature flags. Each flag has a code default and an optional
 * `EXPO_PUBLIC_*` env override ("true"/"false"/"1"/"0"), so a flag can be
 * flipped for a build without a code change.
 */

export function parseFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const v = raw.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'off') return false;
  return fallback;
}

export const FEATURE_FLAGS = {
  /**
   * Feed (workouts, posts, likes, comments, media) and app logs go to
   * Supabase instead of the self-hosted feed server at feed.morf.fyi.
   * Off → the original self-hosted client (lib/services/feedApi.ts).
   * Override: EXPO_PUBLIC_FF_SUPABASE_FEED=false
   */
  supabaseFeed: parseFlag(process.env.EXPO_PUBLIC_FF_SUPABASE_FEED, true),
} as const;
