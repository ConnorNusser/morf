import { ExerciseWithMax } from '@/types';

// Pure (no React / react-native) and clock-INJECTABLE so the "how long since you last
// trained" signal is node-gateable — unlike the inline quickStats/streak useMemo in
// app/(tabs)/history.tsx, which hardcodes new Date() and so can't be asserted against a
// fixed REFERENCE_NOW.
//
// For a lapsed veteran (trained hard, then went quiet) the single most actionable fact on
// the history page is simply "you haven't trained in N days" — but the hero has no per-lift
// PR curve to draw (each lift has < MIN_SESSIONS days) so it falls through to a beginner
// "1 of 3 sessions logged" nudge, and the inline stat line collapses to a flat "N total
// workouts". This module surfaces the comeback fact instead, keyed off the most-recent
// logged history entry across all exercises.

const DAY = 24 * 60 * 60 * 1000;

/** Days since the last logged session past which the hero shows a comeback nudge. */
export const LAPSED_MIN_DAYS = 14;

export interface ActivityStatus {
  /** Date of the most-recent logged session, or null when nothing has been logged. */
  lastWorkoutDate: Date | null;
  /** Whole days from lastWorkoutDate to `now` (>= 0), or null when nothing logged. */
  daysSinceLastWorkout: number | null;
  /** True once daysSinceLastWorkout clears LAPSED_MIN_DAYS. */
  isLapsed: boolean;
}

/**
 * Reduce all logged history down to a single freshness signal. `now` is injected (not read
 * from the clock) so the same call is deterministic under test. An empty history (new user,
 * or bodyweight-only where every set is weight 0) yields nulls and isLapsed=false, so the
 * comeback nudge never fires for someone who simply hasn't started.
 */
export function computeActivityStatus(exerciseStats: ExerciseWithMax[], now: Date): ActivityStatus {
  let lastTime: number | null = null;
  for (const ex of exerciseStats) {
    if (!ex.history) continue;
    for (const h of ex.history) {
      const t = new Date(h.date).getTime();
      if (!Number.isFinite(t)) continue;
      if (lastTime === null || t > lastTime) lastTime = t;
    }
  }

  if (lastTime === null) {
    return { lastWorkoutDate: null, daysSinceLastWorkout: null, isLapsed: false };
  }

  const daysSinceLastWorkout = Math.max(0, Math.floor((now.getTime() - lastTime) / DAY));
  return {
    lastWorkoutDate: new Date(lastTime),
    daysSinceLastWorkout,
    isLapsed: daysSinceLastWorkout >= LAPSED_MIN_DAYS,
  };
}
