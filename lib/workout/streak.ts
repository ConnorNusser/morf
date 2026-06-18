// Week-based training streak.
//
// Strength training prescribes rest days, so a streak of consecutive *days* is
// the wrong unit: a healthy 3×/week lifter sits at a streak of 1 forever, and
// the mechanic meant to pull them back instead punishes the rest days their
// program requires. Here a *week* counts toward the streak when it contains at
// least one workout, and the in-progress week never breaks it (it just hasn't
// been earned yet) — a gap only ends the streak once a fully-elapsed week
// passes with no workout. This mirrors how Hevy/Strava frame weekly streaks.
//
// All week math steps with setDate (not raw millisecond arithmetic) so it stays
// correct across daylight-saving boundaries, and `now` is injectable for tests.
import { GeneratedWorkout } from '@/types';
import { dateKey } from '@/lib/utils/utils';

/** Local Monday (00:00) of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const fromMonday = (d.getDay() + 6) % 7; // 0 = Monday … 6 = Sunday
  d.setDate(d.getDate() - fromMonday);
  return d;
}

function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export interface WeekStreak {
  current: number; // consecutive trained weeks ending this week (or last, if this week is empty so far)
  longest: number; // best run of consecutive trained weeks ever
  trainedThisWeek: boolean; // any workout in the current Mon–Sun week
  trainedToday: boolean;
}

export function getWeekStreak(workouts: GeneratedWorkout[], now: Date = new Date()): WeekStreak {
  if (workouts.length === 0) {
    return { current: 0, longest: 0, trainedThisWeek: false, trainedToday: false };
  }

  // Distinct Monday keys with ≥1 workout, plus distinct day keys for trainedToday.
  const weekKeys = new Set<string>();
  const dayKeys = new Set<string>();
  for (const w of workouts) {
    const created = new Date(w.createdAt);
    weekKeys.add(dateKey(weekStart(created)));
    dayKeys.add(dateKey(created));
  }

  const thisWeek = weekStart(now);
  const trainedThisWeek = weekKeys.has(dateKey(thisWeek));
  const trainedToday = dayKeys.has(dateKey(now));

  // Current run: anchor on this week if trained, else last week (the in-progress
  // week hasn't broken the streak yet). Step back a week at a time until a gap.
  let anchor: Date | null = null;
  if (trainedThisWeek) {
    anchor = thisWeek;
  } else {
    const lastWeek = new Date(thisWeek);
    lastWeek.setDate(lastWeek.getDate() - 7);
    if (weekKeys.has(dateKey(lastWeek))) anchor = lastWeek;
  }

  let current = 0;
  if (anchor) {
    const cursor = new Date(anchor);
    while (weekKeys.has(dateKey(cursor))) {
      current += 1;
      cursor.setDate(cursor.getDate() - 7);
    }
  }

  // Longest run: walk every week from the earliest trained week to this week.
  const earliest = parseDayKey([...weekKeys].sort()[0]);
  let longest = 0;
  let run = 0;
  for (const cur = new Date(earliest); cur.getTime() <= thisWeek.getTime(); cur.setDate(cur.getDate() + 7)) {
    if (weekKeys.has(dateKey(cur))) {
      run += 1;
      if (run > longest) longest = run;
    } else {
      run = 0;
    }
  }

  return { current, longest, trainedThisWeek, trainedToday };
}
