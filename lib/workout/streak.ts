// Week-based training streak (days would punish prescribed rest days). A week
// counts when it has ≥1 workout; the in-progress week never breaks the streak —
// a gap only ends it once a fully-elapsed week passes with no workout.
// Week math steps with setDate (not ms arithmetic) to stay DST-correct; `now` is
// injectable for tests.
import { GeneratedWorkout } from '@/types';
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

export function getWeekStreak(workouts: GeneratedWorkout[], now: Date = new Date()): WeekStreak {
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

// ---------------------------------------------------------------------------
// Streak shields — loss-aversion with forgiveness. Consistency banks shields
// (one per WEEKS_PER_SHIELD consecutive trained weeks, capped) and a shield
// silently bridges a single slipped week instead of zeroing the streak. Two
// empty weeks in a row always break the run regardless of bank: shields save
// a slip, not a lapse — an unbreakable streak stops meaning anything.
// Pure function of history like everything else here: the bank is replayed
// from workouts, never stored, so it can't drift.

export const WEEKS_PER_SHIELD = 4;
export const MAX_SHIELDS = 2;

export interface StreakShieldState {
  current: number; // shielded streak: trained + shield-saved weeks in the active run
  shieldsAvailable: number; // banked and unspent right now
  savedWeeks: number; // empty weeks a shield has bridged in the active run
  savedLastWeek: boolean; // a shield bridged the immediately-previous week — worth celebrating, a rescue nobody notices prevents nothing
  weeksToNextShield: number; // trained weeks until the next shield banks (0 when bank is full)
  trainedThisWeek: boolean;
}

export function getStreakShields(workouts: GeneratedWorkout[], now: Date = new Date()): StreakShieldState {
  const thisWeek = weekStart(now);
  const thisWeekKey = dateKey(thisWeek);

  const weekKeys = new Set<string>();
  for (const w of workouts) {
    const created = new Date(w.createdAt);
    if (created.getTime() <= now.getTime()) weekKeys.add(dateKey(weekStart(created)));
  }
  const trainedThisWeek = weekKeys.has(thisWeekKey);

  if (weekKeys.size === 0) {
    return {
      current: 0,
      shieldsAvailable: 0,
      savedWeeks: 0,
      savedLastWeek: false,
      weeksToNextShield: WEEKS_PER_SHIELD,
      trainedThisWeek: false,
    };
  }

  // Replay every week from the earliest trained week through this week.
  const earliestKey = [...weekKeys].sort()[0];
  const [y, m, d] = earliestKey.split('-').map(Number);

  let current = 0; // trained + saved weeks in the run
  let trainedRun = 0; // trained weeks since the run started (earns shields)
  let shields = 0;
  let saved = 0;
  let consecutiveEmpty = 0;
  let lastSavedKey: string | null = null;

  for (const cur = new Date(y, m - 1, d); cur.getTime() <= thisWeek.getTime(); cur.setDate(cur.getDate() + 7)) {
    const key = dateKey(cur);
    if (weekKeys.has(key)) {
      consecutiveEmpty = 0;
      current += 1;
      trainedRun += 1;
      if (trainedRun % WEEKS_PER_SHIELD === 0 && shields < MAX_SHIELDS) shields += 1;
    } else if (key === thisWeekKey) {
      // The in-progress week never breaks the run or spends a shield.
      break;
    } else {
      consecutiveEmpty += 1;
      if (consecutiveEmpty === 1 && shields > 0) {
        shields -= 1;
        saved += 1;
        current += 1; // the saved week still counts — a spent shield shouldn't read as lost ground
        lastSavedKey = key;
      } else {
        current = 0;
        trainedRun = 0;
        shields = 0;
        saved = 0;
      }
    }
  }

  const lastWeek = new Date(thisWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);

  return {
    current,
    shieldsAvailable: shields,
    savedWeeks: saved,
    savedLastWeek: lastSavedKey === dateKey(lastWeek),
    weeksToNextShield: shields >= MAX_SHIELDS ? 0 : WEEKS_PER_SHIELD - (trainedRun % WEEKS_PER_SHIELD),
    trainedThisWeek,
  };
}
