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
import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';
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

// One e1RM graded against the published standards — the shared vocabulary between
// the lift board's rows and the session hero's standout set, so "12 lbs to B+"
// means the same thing everywhere it appears.
export interface TierGrade {
  tier: StrengthTier;
  percentile: number; // rounded, 0–99
  bandProgress: number; // 0..1 through the current tier's percentile band
  nextTier: StrengthTier | null; // null at S++ (max tier)
  targetWeight: number | null; // e1RM (display unit) that would enter nextTier
  gapWeight: number | null; // targetWeight − current e1RM (display unit), ≥1
  e1rm: number; // the graded e1RM, display unit
}

// The lift's CURRENT strength identity, graded from the latest month's best set (not
// the all-time record) so it stays honest: detrain and the tier — and the tier color
// on the row — really does fall.
export interface LiftTier extends TierGrade {
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
  // The lift's Push/Pull/Legs family — the row's identity color, matching the
  // SessionsFeed emblems and the Career heatmap so split hue means SPLIT everywhere.
  // Null for unmapped/custom lifts.
  split: PPLCategory | null;
  // Why this lift sits where it does in the board (0..1): closeness to its next
  // strength tier blended with real month-over-month movement. A stalled or
  // regressing lift honestly sinks — nothing here only goes up.
  rankScore: number;
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

/**
 * Grade a single e1RM (in lbs) against the published strength standards. The ONE
 * shared grading path: the lift board's rows and the session hero's standout set
 * both go through here, so tier / gap-to-next / band-progress can never disagree.
 * Returns undefined when the lift has no real standards or the e1RM is non-positive
 * — no 50th-percentile fake grades.
 */
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

// Grade one lift from its displayed months: current tier from the LATEST month's best
// set, trend vs the month before it. Returns undefined when the lift has no real
// standards or the set is bodyweight-only — no 50th-percentile fake grades.
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

// e1RM-flavored metric of a displayed point (reps for bodyweight sets) — only used
// for RELATIVE month-over-month movement, so display units are fine.
const pointMetric = (p: LiftProgressPoint): number =>
  p.weight > 0 ? p.weight * (1 + p.reps / 30) : p.reps;

// Month-over-month movement mapped to 0..1 around a neutral 0.5: an ~8% monthly
// e1RM move saturates either way, so a regressing lift really scores BELOW a flat
// one. One shown month = no movement signal = neutral, never fake-positive.
function momentum01(points: LiftProgressPoint[]): number {
  if (points.length < 2) return 0.5;
  const prev = pointMetric(points[points.length - 2]);
  const last = pointMetric(points[points.length - 1]);
  if (prev <= 0) return 0.5;
  const rel = (last - prev) / prev;
  return Math.min(1, Math.max(0, 0.5 + rel * 6));
}

// The board's honest rank: which lift most deserves the top slots. Graded lifts
// score on how deep they sit in their current percentile band (bandProgress — the
// same "X to next tier" source the Career card uses) blended with real recent
// movement. Ungraded lifts can still surface on movement alone, but never outrank
// a lift that is both near a tier boundary and moving.
function rankScore(tier: LiftTier | undefined, points: LiftProgressPoint[]): number {
  const movement = momentum01(points);
  if (tier) return 0.65 * tier.bandProgress + 0.35 * movement;
  return 0.12 + 0.38 * movement;
}

/**
 * Build the progression strip for the given lift ids (e.g. the user's featured
 * lifts). `months` caps how many recent months with data are shown per lift.
 * Lifts with no logged sets are dropped; the result is RANKED, not merely recent:
 * the lifts closest to their next strength tier (and actually moving) lead, so the
 * top of the board is always the "level this up next" shortlist.
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

  // Rank first (tier proximity × movement), recency only breaks ties — the board
  // leads with the lifts worth leveling next, not just whatever was trained last.
  out.sort(
    (a, b) =>
      b.rankScore - a.rankScore ||
      (b.points[b.points.length - 1]?.date.getTime() ?? 0) - (a.points[a.points.length - 1]?.date.getTime() ?? 0),
  );
  return out;
}
