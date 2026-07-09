// Pure helpers behind the retention reminders. `now` is injectable for tests.
import { GeneratedWorkout } from '@/types';
import { getStreakShields, getWeekStreak } from '@/lib/workout/streak';

export interface StreakState {
  current: number; // consecutive trained *weeks* — see lib/workout/streak.ts
  longest: number; // best run ever (comeback copy: a record to chase, not a scolding)
  shieldsAvailable: number; // banked streak shields — see getStreakShields
  trainedThisWeek: boolean;
  trainedToday: boolean;
}

export function getStreakState(workouts: GeneratedWorkout[], now: Date = new Date()): StreakState {
  const { current, longest, trainedThisWeek, trainedToday } = getWeekStreak(workouts, now);
  const { shieldsAvailable } = getStreakShields(workouts, now);
  return { current, longest, shieldsAvailable, trainedThisWeek, trainedToday };
}

// Whole days since the most recent workout (0 = trained today), or null if never.
export function getDaysSinceLastWorkout(workouts: GeneratedWorkout[], now: Date = new Date()): number | null {
  let latest = -Infinity;
  for (const w of workouts) {
    const t = new Date(w.createdAt).getTime();
    if (t <= now.getTime() && t > latest) latest = t;
  }
  if (latest === -Infinity) return null;

  // Count calendar days between local midnights so "yesterday evening → this
  // morning" reads as 1 day, not 0.
  const startOfDay = (ms: number) => { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); };
  return Math.round((startOfDay(now.getTime()) - startOfDay(latest)) / 86_400_000);
}

export interface HabitDay {
  weekday: number; // 0 = Sunday … 6 = Saturday
  medianStartMinute: number; // minutes from local midnight
  count: number;
}

const HABIT_MIN_COUNT = 3;
const HABIT_WINDOW_DAYS = 28;

// The weekday they train most; null unless ≥ HABIT_MIN_COUNT sessions in window.
export function getHabitDay(workouts: GeneratedWorkout[], now: Date = new Date()): HabitDay | null {
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - HABIT_WINDOW_DAYS);

  const byWeekday = new Map<number, number[]>(); // weekday -> [startMinute]
  for (const w of workouts) {
    const d = new Date(w.createdAt);
    if (d < cutoff || d > now) continue;
    const weekday = d.getDay();
    const minute = d.getHours() * 60 + d.getMinutes();
    const bucket = byWeekday.get(weekday);
    if (bucket) bucket.push(minute);
    else byWeekday.set(weekday, [minute]);
  }

  let best: { weekday: number; minutes: number[] } | null = null;
  for (const [weekday, minutes] of byWeekday) {
    if (minutes.length >= HABIT_MIN_COUNT && (!best || minutes.length > best.minutes.length)) {
      best = { weekday, minutes };
    }
  }
  if (!best) return null;

  const sorted = [...best.minutes].sort((a, b) => a - b);
  const medianStartMinute = sorted[Math.floor(sorted.length / 2)];
  return { weekday: best.weekday, medianStartMinute, count: best.minutes.length };
}
