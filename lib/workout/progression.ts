/**
 * Reactive double progression — the single source of truth for "what should this
 * exercise prescribe next session."
 *
 * Design goals (replacing the old 1RM-estimate engine that over-prescribed):
 *  1. ANCHOR TO REALITY. The next prescription is derived from the weight you
 *     actually lifted last time, never a best-ever estimated 1RM. It can't run
 *     away from what you can do — if you self-corrected down to 105, we progress
 *     from 105, not from the 135 we wrongly asked for.
 *  2. DOUBLE PROGRESSION. Reps are the fast lever: climb within a range session to
 *     session, and only step the load once you top the range on every working set.
 *     Load increases are always earned, so over-prescription is impossible.
 *  3. ASYMMETRIC & PROPORTIONAL. Up moves one increment at a time (a fluke can't
 *     re-inflate you). Down is immediate and scales with how badly you missed —
 *     miss the floor by 4 reps and we drop ~12%, not a timid 10% three weeks later.
 *
 * The rule operates on the *limiting* working set (the weakest of your working
 * sets), since that's what actually gates progression.
 */
import { WeightUnit } from '@/types';
import { roundWeight } from '@/lib/utils/utils';
import { getWorkoutById } from './workouts';

/** A rep range for a working set: hit `floor`+ to hold, hit `ceiling` to earn load. */
export interface RepRange {
  floor: number;
  ceiling: number;
}

/** What the lifter actually did on their top working set last session. */
export interface LastPerformance {
  weight: number; // heaviest working-set weight actually used, in `unit`
  reps: number; // reps on the limiting working set at that weight
  unit: WeightUnit;
}

/** The next prescription for the working sets. */
export interface NextPrescription {
  weight: number;
  reps: number; // the rep target to shoot for (the range floor, or one more)
  change: 'increase' | 'hold' | 'add-rep' | 'deload'; // for the UI indicator
}

// How far below the floor still counts as "just a hard day" vs. a real mismatch.
// Within this, we hold and let you retry; beyond it, we drop the load.
const MISS_TOLERANCE_REPS = 1;

// Each rep is worth roughly ~3.3% of load near your working range (the standard
// rep-max relationship). We use it to size the drop: missing the floor by N reps
// means the load was ~3.3%·N too heavy, so drop by that much to land back on the
// floor. Capped so a catastrophic set can't zero you out in one step.
const PCT_PER_REP = 0.033;
const MAX_DROP = 0.25; // never cut more than 25% in a single session

/** Plate increment for one load step — bigger for compounds, smaller for isolations. */
export function loadIncrement(exerciseId: string, unit: WeightUnit): number {
  const exercise = getWorkoutById(exerciseId);
  const isCompound = exercise?.category === 'compound';
  const muscles = exercise?.primaryMuscles ?? [];
  const isBigCompound = isCompound && (muscles.includes('legs') || muscles.includes('glutes') || muscles.includes('back'));

  if (isBigCompound) return unit === 'kg' ? 5 : 10; // squat / deadlift / row
  if (isCompound) return unit === 'kg' ? 2.5 : 5; // bench / press
  return unit === 'kg' ? 1.25 : 2.5; // isolation
}

/**
 * The core rule. Given what you actually did last session and the target range,
 * return the next prescription. Pure and side-effect free.
 */
export function nextPrescription(
  last: LastPerformance,
  range: RepRange,
  increment: number
): NextPrescription {
  const { weight, reps } = last;

  // Topped the range on the limiting set → earn a load step, reset reps to floor.
  if (reps >= range.ceiling) {
    return { weight: roundWeight(weight + increment, last.unit), reps: range.floor, change: 'increase' };
  }

  // Landed inside the range → keep the load, chase one more rep toward the ceiling.
  if (reps >= range.floor) {
    return { weight, reps: Math.min(reps + 1, range.ceiling), change: 'add-rep' };
  }

  // Missed the floor.
  const shortfall = range.floor - reps;

  // A near miss is just a hard day — hold and retry the same target.
  if (shortfall <= MISS_TOLERANCE_REPS) {
    return { weight, reps: range.floor, change: 'hold' };
  }

  // A real miss → drop proportionally to how far short you fell, so next time you
  // land on the floor rather than grinding an impossible weight again.
  const dropPct = Math.min(shortfall * PCT_PER_REP, MAX_DROP);
  const dropped = roundWeight(weight * (1 - dropPct), last.unit);
  // Guarantee the deload actually moves the bar down by at least one increment.
  const newWeight = Math.max(increment, Math.min(dropped, weight - increment));
  return { weight: newWeight, reps: range.floor, change: 'deload' };
}

/** One set as it was actually logged (no warmup flag exists on real sets). */
export interface LoggedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  completed: boolean;
}

/**
 * Pick the working set to judge progression from, out of a real (messy) session
 * that may include warmups and ad-hoc extra/test sets — none of which are tagged.
 *
 * Principle: your working sets are the same load repeated; a warmup ramp is a
 * series of distinct lighter weights, and a one-off form/test set is a lone
 * outlier. So the working weight is THE HEAVIEST WEIGHT YOU DID FOR 2+ SETS.
 * That naturally ignores warmups and stray test sets, and still FOLLOWS you when
 * you self-correct (do all your work at a lighter weight → that's what repeats).
 *
 * Returns null when there's no confident working set (e.g. a single top set with
 * no repeat) — the caller should HOLD rather than guess and make a drastic move.
 */
export function resolveWorkingSet(sets: LoggedSet[]): LastPerformance | null {
  const done = sets.filter(s => s.completed && s.weight > 0 && s.reps > 0);
  if (done.length === 0) return null;

  // Count sets per weight; find the heaviest weight performed at least twice.
  const countByWeight = new Map<number, number>();
  for (const s of done) countByWeight.set(s.weight, (countByWeight.get(s.weight) ?? 0) + 1);

  let workingWeight = -1;
  for (const [w, count] of countByWeight) {
    if (count >= 2 && w > workingWeight) workingWeight = w;
  }

  // Nothing repeated — a pure ramp to a single top set, or one working set plus a
  // test set. We can't confidently tell work from test, so don't guess: hold.
  if (workingWeight < 0) return null;

  const atWeight = done.filter(s => s.weight === workingWeight);
  const reps = Math.min(...atWeight.map(s => s.reps)); // limiting set gates progression
  return { weight: workingWeight, reps, unit: atWeight[0].unit };
}

/**
 * Convenience wrapper: resolve the increment from the exercise and apply the rule.
 * `range` defaults to the programmed reps as the floor and floor+2 as the ceiling.
 */
export function advanceExercise(
  exerciseId: string,
  last: LastPerformance,
  programmedReps: number
): NextPrescription {
  const range: RepRange = { floor: programmedReps, ceiling: programmedReps + 2 };
  return nextPrescription(last, range, loadIncrement(exerciseId, last.unit));
}
