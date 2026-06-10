/**
 * Retention signals — pure, side-effect-free helpers that derive the data the
 * retention notification scheduler needs (current streak, typical training day).
 *
 * Kept separate from the notification layer so the logic is unit-testable with
 * an injectable `now` and synthetic workout data. See
 * docs/specs/retention-notifications.md.
 */
import { GeneratedWorkout } from '@/types';

/** Local-time date key (YYYY-MM-DD), matching recapStats.getDateKey semantics. */
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export interface StreakState {
  /** Consecutive training days ending today or yesterday. */
  current: number;
  /** Whether a workout has already been logged today. */
  trainedToday: boolean;
}

/**
 * Current training streak + whether the user has trained today.
 * Mirrors recapStats.calculateCurrentStreak but takes an injectable `now`
 * (for testing) and also reports trainedToday, which the scheduler needs to
 * decide whether to fire a streak-at-risk reminder.
 */
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
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Median start time as minutes from local midnight. */
  medianStartMinute: number;
  /** How many workouts in the window fell on this weekday. */
  count: number;
}

/** Minimum same-weekday workouts within the window to call it a habit. */
export const HABIT_MIN_COUNT = 3;
/** Look-back window for habit detection (days). */
export const HABIT_WINDOW_DAYS = 28;

/**
 * Detect the user's strongest weekly training habit: the weekday they've
 * trained on at least HABIT_MIN_COUNT times in the last HABIT_WINDOW_DAYS.
 * Returns null if there's no stable pattern.
 */
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
