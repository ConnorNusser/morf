// Pure helpers behind the retention reminders — streak and training-day pattern.
// `now` is injectable so the logic is testable without mocking the clock.
import { GeneratedWorkout } from '@/types';
import { getWeekStreak } from '@/lib/workout/streak';

// Local YYYY-MM-DD, matching recapStats.

export interface StreakState {
  current: number; // consecutive trained *weeks* — see lib/workout/streak.ts
  trainedThisWeek: boolean;
  trainedToday: boolean;
}

// Thin wrapper over the shared week-streak so the reminder layer can reason
// about an at-risk streak (multi-week run + nothing logged yet this week) and
// still tell whether they've already trained today.
export function getStreakState(workouts: GeneratedWorkout[], now: Date = new Date()): StreakState {
  const { current, trainedThisWeek, trainedToday } = getWeekStreak(workouts, now);
  return { current, trainedThisWeek, trainedToday };
}

// Whole days since the most recent workout (0 = trained today), or null if the
// user has never logged one. Drives the comeback nudge for lapsed users — the
// churn-risk segment the streak/habit reminders miss (broken streak, faded habit).
export function getDaysSinceLastWorkout(workouts: GeneratedWorkout[], now: Date = new Date()): number | null {
  let latest = -Infinity;
  for (const w of workouts) {
    const t = new Date(w.createdAt).getTime();
    if (t <= now.getTime() && t > latest) latest = t;
  }
  if (latest === -Infinity) return null;

  // Count calendar days between local midnights so "yesterday evening → this
  // morning" reads as 1 day, not 0, regardless of the clock times.
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

// The weekday they train most — needs at least HABIT_MIN_COUNT sessions in the
// window to count, otherwise null.
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
