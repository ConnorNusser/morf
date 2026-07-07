import { ExerciseWithMax } from '@/types';

// Clock-injectable "how long since you last trained" signal, testable at a fixed now.

const DAY = 24 * 60 * 60 * 1000;

export const LAPSED_MIN_DAYS = 14;

export interface ActivityStatus {
  lastWorkoutDate: Date | null;
  daysSinceLastWorkout: number | null; // whole days to `now`; null when nothing logged
  isLapsed: boolean;
}

// Empty/bodyweight-only history yields nulls and isLapsed=false (nudge never fires unstarted).
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
