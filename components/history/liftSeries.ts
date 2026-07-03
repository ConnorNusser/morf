import { convertWeight, ExerciseHistoryEntry, ExerciseWithMax, WeightUnit } from '@/types';
import { OneRMCalculator } from '@/lib/data/strengthStandards';

// Pure (no React / react-native) so the PR-progression math is unit-testable and
// shared with HistoryHero. History is appended per *set* (history.tsx addEntry runs
// once per completedSet), so the curve/gate must group by day first — otherwise one
// workout of 3 sets fabricates a 3-point "progression" and reads "3 sessions logged".

export const N = 14; // samples per lift (fixed so curves can morph into each other)
export const MIN_SESSIONS = 3; // distinct training days needed to draw a progression

export interface LiftSeries {
  name: string;
  norm: number[]; // N values 0..1, the lift's cumulative-best curve scaled to itself
  current: number; // latest best e1RM, display unit
  gainLbs: number; // all-time gain across the logged window, display unit
  sessions: number; // distinct training days, NOT set count
  startDate: Date; // first logged session
  endDate: Date; // latest logged session
}

// The lift closest to unlocking the hero — drives an actionable "1 of 3" empty state.
export interface NearestLift {
  name: string;
  sessions: number; // distinct days logged so far (< MIN_SESSIONS)
}

// Collapse to one entry per calendar day, keeping that day's best estimated 1RM.
// Exported so the per-workout PR gate (prSessions.ts) keys off the exact same day
// bucket the hero curve does — otherwise a "PR" chip could disagree with the curve.
export const dayKeyOf = (d: Date) => {
  const date = new Date(d);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
};

export const e1rmLbs = (e: Pick<ExerciseHistoryEntry, 'weight' | 'reps' | 'unit'>) =>
  OneRMCalculator.estimate(e.unit === 'kg' ? convertWeight(e.weight, 'kg', 'lbs') : e.weight, e.reps);

interface DaySession {
  date: Date;
  bestLbs: number;
}

// One session = one training day. Returns days sorted oldest→newest.
function toDaySessions(history: ExerciseHistoryEntry[]): DaySession[] {
  const byDay = new Map<string, DaySession>();
  for (const h of history) {
    const key = dayKeyOf(h.date);
    const best = e1rmLbs(h);
    const existing = byDay.get(key);
    if (existing) {
      if (best > existing.bestLbs) existing.bestLbs = best;
    } else {
      byDay.set(key, { date: new Date(h.date), bestLbs: best });
    }
  }
  return [...byDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
}

export function buildLiftSeries(exerciseStats: ExerciseWithMax[], weightUnit: WeightUnit): LiftSeries[] {
  const toUnit = (lbs: number) => (weightUnit === 'kg' ? convertWeight(lbs, 'lbs', 'kg') : lbs);

  const out: LiftSeries[] = [];
  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;
    const days = toDaySessions(ex.history);
    if (days.length < MIN_SESSIONS) continue;

    // cumulative best (PR curve) in lbs, one point per training day
    const cum: number[] = [];
    let best = 0;
    for (const d of days) {
      best = Math.max(best, d.bestLbs);
      cum.push(best);
    }
    const L = cum.length;
    // resample to N evenly-spaced points
    const pts: number[] = [];
    for (let k = 0; k < N; k++) {
      const pos = (k / (N - 1)) * (L - 1);
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      pts.push(cum[lo] + (cum[hi] - cum[lo]) * (pos - lo));
    }
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const norm = pts.map(v => (max > min ? (v - min) / (max - min) : 0.5));
    out.push({
      name: ex.name,
      norm,
      current: Math.round(toUnit(cum[L - 1])),
      gainLbs: Math.round(toUnit(cum[L - 1]) - toUnit(cum[0])),
      sessions: L,
      startDate: days[0].date,
      endDate: days[L - 1].date,
    });
  }
  // most-logged lifts first, capped
  return out.sort((a, b) => b.sessions - a.sessions).slice(0, 6);
}

// When no lift qualifies yet, find the one with the most days so we can tell the
// user exactly how close they are (e.g. "2 of 3 sessions").
export function nearestLift(exerciseStats: ExerciseWithMax[]): NearestLift | null {
  let best: NearestLift | null = null;
  for (const ex of exerciseStats) {
    if (!ex.history || ex.history.length === 0) continue;
    const sessions = toDaySessions(ex.history).length;
    if (sessions >= MIN_SESSIONS) continue; // would have qualified for the real hero
    if (!best || sessions > best.sessions) best = { name: ex.name, sessions };
  }
  return best;
}
