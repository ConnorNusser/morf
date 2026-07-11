// Per-lift progression for the home strip: best working set of each month, oldest→newest.
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
  epleyFactor,
} from '@/lib/data/strengthStandards';
import { getTierBandProgress } from '@/lib/gamification/tierTimeline';
import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { Gender, LoggedWorkout, StrengthStandard, WeightUnit, convertWeight, isMainLift } from '@/types';

export interface LiftProgressPoint {
  weight: number; // display unit; 0 = bodyweight
  reps: number;
  date: Date;
  monthLabel: string;
}

export interface LiftGrading {
  bodyweightLbs: number;
  gender: Gender;
  age?: number;
}

// Shared grading vocabulary between the lift board rows and the session hero.
export interface TierGrade {
  tier: StrengthTier;
  percentile: number; // rounded, 0–99
  bandProgress: number; // 0..1 through the current tier's percentile band
  nextTier: StrengthTier | null; // null at S++ (max tier)
  targetWeight: number | null; // e1RM (display unit) that would enter nextTier
  gapWeight: number | null; // targetWeight − current e1RM, ≥1
  e1rm: number; // display unit
}

// Graded from the latest month's best set (not all-time), so detrain drops the tier.
export interface LiftTier extends TierGrade {
  e1rmDelta: number; // vs previous shown month; signed
}

export interface LiftProgress {
  id: string;
  name: string;
  unit: WeightUnit;
  points: LiftProgressPoint[]; // oldest→newest, one per month, capped
  tierInfo?: LiftTier; // only with real standards + profile bodyweight+gender; never faked
  split: PPLCategory | null;
  rankScore: number; // 0..1: tier proximity blended with movement; stalled lifts sink
}

// Epley 1RM in lbs, so months compare on a unit-invariant basis.
const e1rmLbs = (weight: number, reps: number, unit: WeightUnit): number => {
  const lbs = unit === 'lbs' ? weight : convertWeight(weight, unit, 'lbs');
  return lbs * epleyFactor(reps);
};

const monthKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}`;
const monthLabel = (d: Date): string => d.toLocaleDateString('en-US', { month: 'short' });

interface Raw {
  weight: number;
  reps: number;
  date: Date;
  unit: WeightUnit;
}

// Inverse of calculateStrengthPercentile's piecewise curve: bodyweight ratio AT percentile p.
const ratioAtPercentile = (p: number, s: StrengthStandard): number => {
  if (p <= 10) return (p / 10) * s.beginner;
  if (p <= 25) return s.beginner + ((p - 10) / 15) * (s.intermediate - s.beginner);
  if (p <= 50) return s.intermediate + ((p - 25) / 25) * (s.advanced - s.intermediate);
  if (p <= 75) return s.advanced + ((p - 50) / 25) * (s.elite - s.advanced);
  if (p <= 90) return s.elite + ((p - 75) / 15) * (s.god - s.elite);
  return s.god + ((p - 90) / 9) * (s.god * 0.2);
};

// e1RM (lbs) at percentile p. Forward calc divides ratio by the age factor; inverse multiplies.
const weightAtPercentile = (p: number, s: StrengthStandard, g: LiftGrading): number => {
  const ageFactor = g.age ? (AGE_ADJUSTMENT_FACTORS[getAgeCategory(g.age)] ?? 1) : 1;
  return ratioAtPercentile(p, s) * ageFactor * g.bodyweightLbs;
};

// The ONE shared grading path (lift board rows + session hero). Undefined when no real
// standards or e1RM <= 0 — no fake grades.
export function gradeE1rm(
  id: string,
  e1rmInLbs: number,
  unit: WeightUnit,
  grading: LiftGrading,
): TierGrade | undefined {
  const standards = grading.gender === 'female' ? FEMALE_STANDARDS[id] : MALE_STANDARDS[id];
  if (!standards || e1rmInLbs <= 0) return undefined;

  const toDisplay = (lbs: number) => Math.round(unit === 'lbs' ? lbs : convertWeight(lbs, 'lbs', unit));

  const percentile = calculateStrengthPercentile(e1rmInLbs, grading.bodyweightLbs, grading.gender, id, grading.age);
  const tier = getStrengthTier(percentile);
  const band = getTierBandProgress(percentile);

  const nextThreshold = TIER_THRESHOLDS.find(t => t.threshold > percentile) ?? null;
  const targetWeight = nextThreshold
    ? toDisplay(weightAtPercentile(nextThreshold.threshold, standards, grading))
    : null;
  const e1rm = toDisplay(e1rmInLbs);
  const gapWeight = targetWeight != null ? Math.max(1, targetWeight - e1rm) : null;

  return {
    tier,
    percentile: Math.round(percentile),
    bandProgress: band.progress,
    nextTier: nextThreshold?.label ?? null,
    targetWeight,
    gapWeight,
    e1rm,
  };
}

// Grade one lift from the LATEST month's best set, trend vs the month before.
function gradeLift(id: string, recent: { set: Raw }[], unit: WeightUnit, grading: LiftGrading): LiftTier | undefined {
  const latest = recent[recent.length - 1]?.set;
  if (!latest || latest.weight <= 0) return undefined;

  const toLbs = (s: Raw) => (s.unit === 'lbs' ? s.weight : convertWeight(s.weight, s.unit, 'lbs'));
  const toDisplay = (lbs: number) => Math.round(unit === 'lbs' ? lbs : convertWeight(lbs, 'lbs', unit));

  const grade = gradeE1rm(id, OneRMCalculator.estimate(toLbs(latest), latest.reps), unit, grading);
  if (!grade) return undefined;

  const prev = recent.length > 1 ? recent[recent.length - 2].set : null;
  const e1rmDelta =
    prev && prev.weight > 0 ? grade.e1rm - toDisplay(OneRMCalculator.estimate(toLbs(prev), prev.reps)) : 0;

  return { ...grade, e1rmDelta };
}

// reps for bodyweight; only for RELATIVE movement, so display units are fine.
const pointMetric = (p: LiftProgressPoint): number =>
  p.weight > 0 ? p.weight * epleyFactor(p.reps) : p.reps;

// Month-over-month movement to 0..1 around neutral 0.5; ~8% monthly move saturates. One month = neutral.
function momentum01(points: LiftProgressPoint[]): number {
  if (points.length < 2) return 0.5;
  const prev = pointMetric(points[points.length - 2]);
  const last = pointMetric(points[points.length - 1]);
  if (prev <= 0) return 0.5;
  const rel = (last - prev) / prev;
  return Math.min(1, Math.max(0, 0.5 + rel * 6));
}

// Graded lifts score on band depth blended with movement; ungraded surface on movement alone.
function rankScore(tier: LiftTier | undefined, points: LiftProgressPoint[]): number {
  const movement = momentum01(points);
  if (tier) return 0.65 * tier.bandProgress + 0.35 * movement;
  return 0.12 + 0.38 * movement;
}

// `months` caps recent months-with-data per lift. Result RANKED, not merely recent.
export function buildLiftProgressions(
  history: LoggedWorkout[],
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

    const tierInfo = grading ? gradeLift(id, recent, unit, grading) : undefined;
    const muscle = getExercise(id)?.primaryMuscles?.[0];
    out.push({
      id,
      name: getExercise(id)?.name ?? id,
      unit,
      points,
      tierInfo,
      split: muscle ? (MUSCLE_TO_PPL[muscle] ?? null) : null,
      rankScore: rankScore(tierInfo, points),
    });
  }

  // Main lifts first (squat/bench/deadlift/OHP), then rankScore, recency breaking ties.
  out.sort(
    (a, b) =>
      Number(isMainLift(b.id)) - Number(isMainLift(a.id)) ||
      b.rankScore - a.rankScore ||
      (b.points[b.points.length - 1]?.date.getTime() ?? 0) - (a.points[a.points.length - 1]?.date.getTime() ?? 0),
  );
  return out;
}
