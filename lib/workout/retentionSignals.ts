// Pure helpers behind the retention reminders — streak and training-day pattern.
// `now` is injectable so the logic is testable without mocking the clock.
import { GeneratedWorkout } from '@/types';

// Local YYYY-MM-DD, matching recapStats.
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface StreakState {
  current: number;
  trainedToday: boolean;
}

// Like recapStats' streak count, but also reports whether they've trained today
// (which decides whether a streak reminder is still worth firing).
export function getStreakState(workouts: GeneratedWorkout[], now: Date = new Date()): StreakState {
  if (workouts.length === 0) return { current: 0, trainedToday: false };

  const keys = new Set(workouts.map(w => dateKey(new Date(w.createdAt))));

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayKey = dateKey(today);
  const trainedToday = keys.has(todayKey);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = dateKey(yesterday);

  // A streak only counts if the most recent training day is today or yesterday.
  if (!trainedToday && !keys.has(yesterdayKey)) {
    return { current: 0, trainedToday };
  }

  const cursor = new Date(trainedToday ? today : yesterday);
  let current = 0;
  while (keys.has(dateKey(cursor))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return { current, trainedToday };
}

export interface HabitDay {
  weekday: number; // 0 = Sunday … 6 = Saturday
  medianStartMinute: number; // minutes from local midnight
  count: number;
}

export const HABIT_MIN_COUNT = 3;
export const HABIT_WINDOW_DAYS = 28;

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
