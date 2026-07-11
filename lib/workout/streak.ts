// Week-based training streak (days would punish prescribed rest days). A week
// counts when it has ≥1 workout; the in-progress week never breaks the streak —
// a gap only ends it once a fully-elapsed week passes with no workout.
// Week math steps with setDate (not ms arithmetic) to stay DST-correct; `now` is
// injectable for tests.
import { LoggedWorkout } from '@/types';
import { dateKey, weekStart } from '@/lib/utils/utils';

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

export function getWeekStreak(workouts: LoggedWorkout[], now: Date = new Date()): WeekStreak {
  if (workouts.length === 0) {
    return { current: 0, longest: 0, trainedThisWeek: false, trainedToday: false };
  }

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

  // Anchor on this week if trained, else last week (in-progress week doesn't
  // break the streak); step back weekly until a gap.
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
