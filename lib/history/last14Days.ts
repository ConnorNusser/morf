// The Home "Last 14 days" grid: six stats over the trailing two weeks, each
// compared with the two weeks before. Pure — everything derives from history.
import { pplForExercise, PPLCategory } from '@/lib/data/pplCategories';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { calculateWorkoutStats } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { LoggedWorkout } from '@/types';

export const WINDOW_DAYS = 14;

export interface WindowDelta {
  current: number;
  previous: number;
  /** Signed % change vs the previous window; null when there's no baseline. */
  pct: number | null;
}

export interface WindowPR {
  exerciseId: string;
  name: string;
  e1rmLbs: number;
  gainLbs: number; // over the best before the window; 0 for a first-ever lift
}

export interface TopLift {
  exerciseId: string;
  name: string;
  sets: number;
  bestE1rmLbs: number; // 0 for bodyweight/timed
}

export interface Last14Days {
  /** Local-midnight start of each day, oldest first (length WINDOW_DAYS). */
  days: Date[];
  /** Sessions per day, aligned with `days`. */
  sessionsByDay: number[];
  /** Volume (lbs) per day, aligned with `days`. */
  volumeByDay: number[];
  sessions: WindowDelta;
  activeDays: number;
  volumeLbs: WindowDelta;
  sets: WindowDelta;
  reps: number;
  prs: WindowPR[]; // biggest gain first
  split: Record<PPLCategory, number>; // working sets per category
  topLift: TopLift | null;
}

const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function delta(current: number, previous: number): WindowDelta {
  return {
    current,
    previous,
    pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
  };
}

const trackingTypeOf = (id: string) => getExercise(id)?.trackingType;

function nameOf(id: string): string {
  return shortName(getExercise(id)?.name || id.replace('custom_', '').replace(/-/g, ' '));
}

function completedSets(w: LoggedWorkout) {
  return w.exercises.flatMap(ex => (ex.completedSets || []).filter(s => s.completed).map(s => ({ ex, s })));
}

export function computeLast14Days(history: LoggedWorkout[], now: Date = new Date()): Last14Days {
  const today = startOfDay(now);
  const windowStart = addDays(today, -(WINDOW_DAYS - 1));
  const windowEnd = addDays(today, 1);
  const prevStart = addDays(windowStart, -WINDOW_DAYS);

  const time = (w: LoggedWorkout) => new Date(w.createdAt).getTime();
  const inWindow = history.filter(w => time(w) >= windowStart.getTime() && time(w) < windowEnd.getTime());
  const inPrev = history.filter(w => time(w) >= prevStart.getTime() && time(w) < windowStart.getTime());
  const before = history.filter(w => time(w) < windowStart.getTime());

  const days = Array.from({ length: WINDOW_DAYS }, (_, i) => addDays(windowStart, i));
  const sessionsByDay = new Array(WINDOW_DAYS).fill(0);
  const volumeByDay = new Array(WINDOW_DAYS).fill(0);

  const statsOf = (w: LoggedWorkout) => calculateWorkoutStats(w.exercises, trackingTypeOf);
  const totals = (ws: LoggedWorkout[]) =>
    ws.reduce((acc, w) => {
      const st = statsOf(w);
      return { volume: acc.volume + st.totalVolumeLbs, sets: acc.sets + st.totalSets };
    }, { volume: 0, sets: 0 });

  for (const w of inWindow) {
    // Bucket by local calendar day (DST-safe: compare day starts, not ms / 24h).
    const day = startOfDay(new Date(w.createdAt)).getTime();
    const i = days.findIndex(d => d.getTime() === day);
    if (i < 0) continue;
    sessionsByDay[i]++;
    volumeByDay[i] += statsOf(w).totalVolumeLbs;
  }

  const cur = totals(inWindow);
  const prev = totals(inPrev);

  // Reps, split and per-lift tallies over working sets in the window.
  let reps = 0;
  const split: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };
  const liftSets = new Map<string, number>();
  const windowBest = new Map<string, number>();
  for (const w of inWindow) {
    for (const { ex, s } of completedSets(w)) {
      if (s.isWarmup) continue;
      const info = getExercise(ex.id);
      const tracking = info?.trackingType || 'reps';
      if (tracking === 'reps') reps += s.reps || 0;
      const cat = pplForExercise(info);
      if (cat) split[cat]++;
      liftSets.set(ex.id, (liftSets.get(ex.id) || 0) + 1);
      if (tracking === 'reps' && (s.weight || 0) > 0 && (s.reps || 0) > 0) {
        const e = e1rmLbs(s.weight, s.reps, s.unit || 'lbs');
        if (e > (windowBest.get(ex.id) || 0)) windowBest.set(ex.id, e);
      }
    }
  }

  // PR = window-best e1RM beats every earlier set of that lift (first-ever counts,
  // matching the league's rule in 015_league_pr_firsts.sql).
  const priorBest = new Map<string, number>();
  for (const w of before) {
    for (const { ex, s } of completedSets(w)) {
      if ((s.weight || 0) <= 0 || (s.reps || 0) <= 0) continue;
      if ((getExercise(ex.id)?.trackingType || 'reps') !== 'reps') continue;
      const e = e1rmLbs(s.weight, s.reps, s.unit || 'lbs');
      if (e > (priorBest.get(ex.id) || 0)) priorBest.set(ex.id, e);
    }
  }
  const prs: WindowPR[] = [];
  for (const [id, best] of windowBest) {
    const prior = priorBest.get(id) || 0;
    if (best > prior) {
      prs.push({ exerciseId: id, name: nameOf(id), e1rmLbs: Math.round(best), gainLbs: prior > 0 ? Math.round(best - prior) : 0 });
    }
  }
  prs.sort((a, b) => b.gainLbs - a.gainLbs || b.e1rmLbs - a.e1rmLbs);

  let topLift: TopLift | null = null;
  for (const [id, sets] of liftSets) {
    const bestE1rm = Math.round(windowBest.get(id) || 0);
    if (!topLift || sets > topLift.sets || (sets === topLift.sets && bestE1rm > topLift.bestE1rmLbs)) {
      topLift = { exerciseId: id, name: nameOf(id), sets, bestE1rmLbs: bestE1rm };
    }
  }

  return {
    days,
    sessionsByDay,
    volumeByDay,
    sessions: delta(inWindow.length, inPrev.length),
    activeDays: sessionsByDay.filter(n => n > 0).length,
    volumeLbs: delta(cur.volume, prev.volume),
    sets: delta(cur.sets, prev.sets),
    reps,
    prs,
    split,
    topLift,
  };
}
