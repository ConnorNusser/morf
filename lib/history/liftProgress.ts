// Per-lift progression for the home strip: for each lift, the best working set of
// each month across its history, laid out oldest→newest so the left→right order
// encodes time (the month label under each point makes it explicit). Pure so it's
// unit-testable and node-gate-able.
import {
  AGE_ADJUSTMENT_FACTORS,
  calculateStrengthPercentile,
  FEMALE_STANDARDS,
  getAgeCategory,
  getStrengthTier,
  MALE_STANDARDS,
  OneRMCalculator,
  StrengthTier,
  TIER_THRESHOLDS,
} from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { getExercise } from '@/lib/workout/workouts';
import { Gender, GeneratedWorkout, StrengthStandard, WeightUnit, convertWeight } from '@/types';

export interface LiftProgressPoint {
  weight: number; // in the preferred unit; 0 for a bodyweight set
  reps: number;
  date: Date; // the day this month's best set was logged
  monthLabel: string; // "Mar", "Jul"
}

// What buildLiftProgressions needs to grade a lift against the strength standards —
// the same profile inputs the Records strip and the Career card already use.
export interface LiftGrading {
  bodyweightLbs: number;
  gender: Gender;
  age?: number;
}

// The lift's CURRENT strength identity, graded from the latest month's best set (not
// the all-time record) so it stays honest: detrain and the tier — and the tier color
// on the row — really does fall.
export interface LiftTier {
  tier: StrengthTier;
  percentile: number; // rounded, 0–99
  bandProgress: number; // 0..1 through the current tier's percentile band
  nextTier: StrengthTier | null; // null at S++ (max tier)
  targetWeight: number | null; // e1RM (display unit) that would enter nextTier
  gapWeight: number | null; // targetWeight − current e1RM (display unit), ≥1
  e1rm: number; // latest month's best-set e1RM, display unit
  e1rmDelta: number; // vs the previous shown month's best e1RM; signed, 0 if none
}

export interface LiftProgress {
  id: string;
  name: string;
  unit: WeightUnit;
  points: LiftProgressPoint[]; // oldest → newest, one per month, capped
  // Present only when the lift has real published standards AND the profile has
  // bodyweight + gender — never faked from the 50th-percentile fallback.
  tierInfo?: LiftTier;
}

// Epley 1RM in lbs, so months are compared on a unit-invariant "best set" basis.
const e1rmLbs = (weight: number, reps: number, unit: WeightUnit): number => {
  const lbs = unit === 'lbs' ? weight : convertWeight(weight, unit, 'lbs');
  return lbs * (1 + reps / 30);
};

const monthKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}`;
const monthLabel = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short' });

interface Raw {
  weight: number;
  reps: number;
  date: Date;
  unit: WeightUnit;
}

// Invert calculateStrengthPercentile's piecewise curve: the bodyweight ratio that
// sits AT a given percentile. Used to turn "next tier at the 63rd percentile" into
// an actual barbell number ("+12 lbs of e1RM to B+").
const ratioAtPercentile = (p: number, s: StrengthStandard): number => {
  if (p <= 10) return (p / 10) * s.beginner;
  if (p <= 25) return s.beginner + ((p - 10) / 15) * (s.intermediate - s.beginner);
  if (p <= 50) return s.intermediate + ((p - 25) / 25) * (s.advanced - s.intermediate);
  if (p <= 75) return s.advanced + ((p - 50) / 25) * (s.elite - s.advanced);
  if (p <= 90) return s.elite + ((p - 75) / 15) * (s.god - s.elite);
  return s.god + ((p - 90) / 9) * (s.god * 0.2);
};

// e1RM (lbs) needed to sit at percentile `p` — the forward calc divides the ratio by
// the age factor, so the inverse multiplies it back in.
const weightAtPercentile = (p: number, s: StrengthStandard, g: LiftGrading): number => {
  const ageFactor = g.age ? (AGE_ADJUSTMENT_FACTORS[getAgeCategory(g.age)] ?? 1) : 1;
  return ratioAtPercentile(p, s) * ageFactor * g.bodyweightLbs;
};

// Grade one lift from its displayed months: current tier from the LATEST month's best
// set, trend vs the month before it. Returns undefined when the lift has no real
// standards or the set is bodyweight-only — no 50th-percentile fake grades.
function gradeLift(id: string, recent: { set: Raw }[], unit: WeightUnit, grading: LiftGrading): LiftTier | undefined {
  const standards = grading.gender === 'female' ? FEMALE_STANDARDS[id] : MALE_STANDARDS[id];
  const latest = recent[recent.length - 1]?.set;
  if (!standards || !latest || latest.weight <= 0) return undefined;

  const toLbs = (s: Raw) => (s.unit === 'lbs' ? s.weight : convertWeight(s.weight, s.unit, 'lbs'));
  const toDisplay = (lbs: number) => Math.round(unit === 'lbs' ? lbs : convertWeight(lbs, 'lbs', unit));

  const e1rmLatest = OneRMCalculator.estimate(toLbs(latest), latest.reps);
  if (e1rmLatest <= 0) return undefined;
  const percentile = calculateStrengthPercentile(e1rmLatest, grading.bodyweightLbs, grading.gender, id, grading.age);
  const tier = getStrengthTier(percentile);
  const band = getTierBandProgress(percentile);

  const nextThreshold = TIER_THRESHOLDS.find(t => t.threshold > percentile) ?? null;
  const targetWeight = nextThreshold
    ? toDisplay(weightAtPercentile(nextThreshold.threshold, standards, grading))
    : null;
  const e1rm = toDisplay(e1rmLatest);
  const gapWeight = targetWeight != null ? Math.max(1, targetWeight - e1rm) : null;

  const prev = recent.length > 1 ? recent[recent.length - 2].set : null;
  const e1rmDelta =
    prev && prev.weight > 0 ? e1rm - toDisplay(OneRMCalculator.estimate(toLbs(prev), prev.reps)) : 0;

  return {
    tier,
    percentile: Math.round(percentile),
    bandProgress: band.progress,
    nextTier: nextThreshold?.label ?? null,
    targetWeight,
    gapWeight,
    e1rm,
    e1rmDelta,
  };
}

/**
 * Build the progression strip for the given lift ids (e.g. the user's featured
 * lifts). `months` caps how many recent months with data are shown per lift.
 * Lifts with no logged sets are dropped; the result is ordered by most-recent
 * activity so the lifts you're currently training lead.
 */
export function buildLiftProgressions(
  history: GeneratedWorkout[],
  liftIds: string[],
  unit: WeightUnit,
  months = 4,
  grading?: LiftGrading | null,
): LiftProgress[] {
  const want = new Set(liftIds);
  const byLift = new Map<string, Raw[]>();
  for (const w of history) {
    const date = new Date(w.createdAt);
    for (const ex of w.exercises || []) {
      if (!want.has(ex.id)) continue;
      for (const s of ex.completedSets || []) {
        if (!s.completed) continue;
        const list = byLift.get(ex.id) ?? [];
        list.push({ weight: s.weight, reps: s.reps, date, unit: s.unit });
        byLift.set(ex.id, list);
      }
    }
  }

  const out: LiftProgress[] = [];
  for (const id of liftIds) {
    const sets = byLift.get(id);
    if (!sets || sets.length === 0) continue;

    // Best (highest estimated 1RM) set per calendar month.
    const bestByMonth = new Map<string, { set: Raw; e1rm: number }>();
    for (const s of sets) {
      const key = monthKey(s.date);
      const e1rm = e1rmLbs(s.weight, s.reps, s.unit);
      const cur = bestByMonth.get(key);
      if (!cur || e1rm > cur.e1rm) bestByMonth.set(key, { set: s, e1rm });
    }

    const recent = [...bestByMonth.values()]
      .sort((a, b) => a.set.date.getTime() - b.set.date.getTime())
      .slice(-months);

    const points: LiftProgressPoint[] = recent.map(({ set }) => ({
      weight: Math.round(set.unit === unit ? set.weight : convertWeight(set.weight, set.unit, unit)),
      reps: set.reps,
      date: set.date,
      monthLabel: monthLabel(set.date),
    }));

    out.push({
      id,
      name: getExercise(id)?.name ?? id,
      unit,
      points,
      tierInfo: grading ? gradeLift(id, recent, unit, grading) : undefined,
    });
  }

  out.sort(
    (a, b) => (b.points[b.points.length - 1]?.date.getTime() ?? 0) - (a.points[a.points.length - 1]?.date.getTime() ?? 0),
  );
  return out;
}
