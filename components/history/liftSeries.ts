import { convertWeight, ExerciseHistoryEntry, ExerciseWithMax, Gender, WeightUnit } from '@/types';
import {
  calculateStrengthPercentile,
  FEMALE_STANDARDS,
  getStrengthTier,
  MALE_STANDARDS,
  OneRMCalculator,
  StrengthTier,
} from '@/lib/data/strengthStandards';

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


// ── Aggregate Strength Index ───────────────────────────────────────────────────
//
// The portfolio-level answer to "am I stronger overall than N weeks ago?". Instead
// of a raw summed est-1RM (a monotonic, always-green vanity number), this reuses the
// app's OWN normalized model: each tracked barbell/dumbbell/machine lift with a
// published strength standard is scored to a 0–99 bodyweight percentile
// (calculateStrengthPercentile), and the index is the mean of those percentiles at a
// point in time. That number is bounded, comparative ("you're 52nd percentile"), and
// can genuinely DROP — starting a new weak lift, or gaining bodyweight faster than the
// bar, pulls the average down. Summed lbs never can.

export type IndexTimeframe = '6W' | '3M' | '1Y' | 'ALL';

const TIMEFRAME_DAYS: Record<IndexTimeframe, number | null> = {
  '6W': 42,
  '3M': 91,
  '1Y': 365,
  ALL: null, // from the first logged standard lift
};

export interface StrengthIndexSeries {
  norm: number[];        // N values 0..1 — the curve, auto-scaled to its own range
  current: number;       // latest overall percentile (0..99)
  previous: number;      // overall percentile at the start of the timeframe
  delta: number;         // current - previous (percentile points; may be negative)
  tier: StrengthTier;    // tier of the current index
  liftCount: number;     // standard lifts contributing at the latest sample
  startDate: Date;       // first sample date actually used (clamped to real data)
  endDate: Date;         // latest logged training day
  hasData: boolean;      // enough signal to draw the index hero
}

interface IndexLift {
  exerciseId: string;
  days: DaySession[]; // oldest→newest, one per training day (cumulative best taken at sample time)
}

// Best est-1RM (lbs) this lift had demonstrated on or before `t` — its PR-to-date.
function bestLbsAsOf(days: DaySession[], t: number): number | null {
  let best: number | null = null;
  for (const d of days) {
    if (d.date.getTime() > t) break; // days are sorted ascending
    if (best === null || d.bestLbs > best) best = d.bestLbs;
  }
  return best;
}

/**
 * Build the Strength Index curve over the selected timeframe.
 *
 * @param bodyweightLbs the lifter's current bodyweight in lbs (percentiles are ratio-based)
 * @param gender        drives which standards table is used
 * @param age           optional age adjustment (older lifters graded on a gentler curve)
 */
export function buildStrengthIndexSeries(
  exerciseStats: ExerciseWithMax[],
  bodyweightLbs: number,
  gender: Gender,
  timeframe: IndexTimeframe,
  age?: number
): StrengthIndexSeries {
  const empty: StrengthIndexSeries = {
    norm: new Array(N).fill(0),
    current: 0,
    previous: 0,
    delta: 0,
    tier: 'E-',
    liftCount: 0,
    startDate: new Date(),
    endDate: new Date(),
    hasData: false,
  };
  if (!bodyweightLbs || bodyweightLbs <= 0) return empty;

  // Only lifts with a published standard for this gender contribute — otherwise the
  // mean would be diluted by a flat 50th-percentile default for unranked accessories.
  const stdMap = gender === 'male' ? MALE_STANDARDS : FEMALE_STANDARDS;

  const lifts: IndexLift[] = [];
  const uniqueDayKeys = new Set<string>();
  for (const ex of exerciseStats) {
    if (!stdMap[ex.id]) continue;
    if (!ex.history || ex.history.length === 0) continue;
    const days = toDaySessions(ex.history).filter(d => d.bestLbs > 0);
    if (days.length === 0) continue;
    lifts.push({ exerciseId: ex.id, days });
    for (const d of days) uniqueDayKeys.add(dayKeyOf(d.date));
  }
  if (lifts.length === 0 || uniqueDayKeys.size < MIN_SESSIONS) return empty;

  // End at the latest real training day across contributing lifts; start `timeframe`
  // back from there, clamped forward to the first logged day so early samples aren't
  // empty flat-line padding.
  let firstMs = Infinity;
  let lastMs = -Infinity;
  for (const l of lifts) {
    firstMs = Math.min(firstMs, l.days[0].date.getTime());
    lastMs = Math.max(lastMs, l.days[l.days.length - 1].date.getTime());
  }
  const spanDays = TIMEFRAME_DAYS[timeframe];
  const startMs = spanDays === null ? firstMs : Math.max(firstMs, lastMs - spanDays * 86_400_000);
  if (lastMs <= startMs) return empty;

  // Overall percentile at instant `t`: mean of each contributing lift's PR-to-date
  // percentile. A lift with no session yet at `t` simply doesn't count.
  const indexAt = (t: number): { value: number; count: number } => {
    const pcts: number[] = [];
    for (const l of lifts) {
      const lbs = bestLbsAsOf(l.days, t);
      if (lbs === null) continue;
      pcts.push(calculateStrengthPercentile(lbs, bodyweightLbs, gender, l.exerciseId, age));
    }
    if (pcts.length === 0) return { value: 0, count: 0 };
    const sum = pcts.reduce((a, b) => a + b, 0);
    return { value: sum / pcts.length, count: pcts.length };
  };

  const raw: number[] = [];
  let latestCount = 0;
  for (let k = 0; k < N; k++) {
    const t = startMs + (k / (N - 1)) * (lastMs - startMs);
    const { value, count } = indexAt(t);
    raw.push(value);
    if (k === N - 1) latestCount = count;
  }

  const current = Math.round(raw[N - 1]);
  const previous = Math.round(raw[0]);

  // Auto-scale to the curve's own min/max (Robinhood style) so a few-point move is
  // still visible, while a flat index reads as a flat line.
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const norm = raw.map(v => (max > min ? (v - min) / (max - min) : 0.5));

  return {
    norm,
    current,
    previous,
    delta: current - previous,
    tier: getStrengthTier(current),
    liftCount: latestCount,
    startDate: new Date(startMs),
    endDate: new Date(lastMs),
    hasData: true,
  };
}
