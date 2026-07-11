/**
 * Reactive double progression — the single source of truth for what an exercise prescribes next session.
 *  1. ANCHOR TO REALITY: next prescription derives from the weight actually lifted last time, never a best-ever estimated 1RM, so it can't run past what you can do.
 *  2. DOUBLE PROGRESSION: reps climb within a range session to session; load only steps once the range is topped, so load increases are always earned.
 *  3. ASYMMETRIC & PROPORTIONAL: up moves one increment at a time; down is immediate and scales with how badly you missed (miss the floor by 4 reps → drop ~12%).
 * Judged on the TYPICAL (median) working set — one collapsed fatigue set can neither
 * condemn a session where the others beat the ceiling, nor earn anything alone.
 */
import { WeightUnit, ExerciseRecord, convertWeight, isFeaturedLift } from '@/types';
import { roundWeight } from '@/lib/utils/utils';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import { getCatalogExercise } from './exerciseCatalog';

/** A rep range for a working set: hit `floor`+ to hold, hit `ceiling` to earn load. */
export interface RepRange {
  floor: number;
  ceiling: number;
}

/** What the lifter actually did on their top working set last session. */
export interface LastPerformance {
  weight: number; // heaviest working-set weight used, in `unit`
  reps: number; // reps on the limiting working set at that weight
  unit: WeightUnit;
}

/** The next prescription for the working sets. */
export interface NextPrescription {
  weight: number;
  reps: number;
  change: 'increase' | 'hold' | 'add-rep' | 'deload';
}

// Miss below the floor within this is "just a hard day" (hold and retry); beyond it, drop the load.
const MISS_TOLERANCE_REPS = 1;

// ~3.3% of load per rep near the working range (standard rep-max relationship): missing the floor by N reps means ~3.3%·N too heavy, so drop that much to land on the floor.
const PCT_PER_REP = 0.033;
const MAX_DROP = 0.25; // never cut more than 25% in a single session

/** Plate increment for one load step — bigger for compounds, smaller for isolations. */
export function loadIncrement(exerciseId: string, unit: WeightUnit): number {
  const exercise = getCatalogExercise(exerciseId);
  const isCompound = exercise?.category === 'compound';
  const muscles = exercise?.primaryMuscles ?? [];
  const isBigCompound = isCompound && (muscles.includes('legs') || muscles.includes('glutes') || muscles.includes('back'));

  if (isBigCompound) return unit === 'kg' ? 5 : 10; // squat / deadlift / row
  if (isCompound) return unit === 'kg' ? 2.5 : 5; // bench / press
  return unit === 'kg' ? 1.25 : 2.5; // isolation
}

/** The core rule: last session's performance + target range → next prescription. Pure. */
export function nextPrescription(
  last: LastPerformance,
  range: RepRange,
  increment: number
): NextPrescription {
  const { weight, reps } = last;

  // Topped the range → earn a load step, reset reps to floor.
  if (reps >= range.ceiling) {
    return { weight: roundWeight(weight + increment, last.unit), reps: range.floor, change: 'increase' };
  }

  // Inside the range → keep the load, chase one more rep. (Round to the plate
  // grid — a kg-logged anchor shown in lbs would otherwise prescribe 226.)
  if (reps >= range.floor) {
    return { weight: roundWeight(weight, last.unit), reps: Math.min(reps + 1, range.ceiling), change: 'add-rep' };
  }

  const shortfall = range.floor - reps;

  // Near miss → hold and retry.
  if (shortfall <= MISS_TOLERANCE_REPS) {
    return { weight: roundWeight(weight, last.unit), reps: range.floor, change: 'hold' };
  }

  // Real miss → drop proportionally to the shortfall so next time you land on the floor.
  const dropPct = Math.min(shortfall * PCT_PER_REP, MAX_DROP);
  const dropped = roundWeight(weight * (1 - dropPct), last.unit);
  // Guarantee the deload moves the bar down by at least one increment.
  const newWeight = Math.max(increment, Math.min(dropped, weight - increment));
  return { weight: newWeight, reps: range.floor, change: 'deload' };
}

/** One logged set. `isWarmup` is recorded at save time; legacy history lacks it. */
export interface LoggedSet {
  weight: number;
  reps: number;
  unit: WeightUnit;
  completed: boolean;
  isWarmup?: boolean;
}

/**
 * The working set to judge progression from: flagged warmups excluded, then the
 * repeated weight with the most sets (ties → heaviest) so a top single reads as a
 * test. Nothing repeated → heaviest when roles are recorded (all known work);
 * null on unlabeled legacy sessions — hold rather than move off a guess.
 */
export function resolveWorkingSet(sets: LoggedSet[]): LastPerformance | null {
  const hasRecordedRoles = sets.some(s => s.isWarmup !== undefined);
  const done = sets.filter(s => s.completed && s.weight > 0 && s.reps > 0 && s.isWarmup !== true);
  if (done.length === 0) return null;

  const countByWeight = new Map<number, number>();
  for (const s of done) countByWeight.set(s.weight, (countByWeight.get(s.weight) ?? 0) + 1);

  let workingWeight = -1;
  let workingCount = 0;
  for (const [w, count] of countByWeight) {
    if (count < 2) continue;
    if (count > workingCount || (count === workingCount && w > workingWeight)) {
      workingWeight = w;
      workingCount = count;
    }
  }

  if (workingWeight < 0) {
    if (!hasRecordedRoles) return null; // can't tell work from test — hold
    const top = done.reduce((a, b) => (b.weight > a.weight ? b : a));
    return { weight: top.weight, reps: top.reps, unit: top.unit };
  }

  const atWeight = done.filter(s => s.weight === workingWeight);
  // Lower median: 8,9,9,4 judges as 8 (the 4 is the fatigue bill for the
  // overshoot, not a miss), while 6,4,4,4 still judges as 4.
  const sorted = atWeight.map(s => s.reps).sort((a, b) => a - b);
  const reps = sorted[Math.floor((sorted.length - 1) / 2)];
  return { weight: workingWeight, reps, unit: atWeight[0].unit };
}

const e1rmLbs = (weight: number, reps: number, unit: WeightUnit): number =>
  OneRMCalculator.estimate(unit === 'kg' ? convertWeight(weight, 'kg', 'lbs') : weight, reps);

// Record-keeping variant: falls back to the heaviest lone set. Never used for
// routine anchors — prescriptions must not lurch off a stray single.
function recordableSet(sets: LoggedSet[]): LastPerformance | null {
  const resolved = resolveWorkingSet(sets);
  if (resolved) return resolved;
  const done = sets.filter(s => s.completed && s.weight > 0 && s.reps > 0);
  if (done.length === 0) return null;
  const top = done.reduce((a, b) => (b.weight > a.weight ? b : a));
  return { weight: top.weight, reps: top.reps, unit: top.unit };
}

// Fold a finished workout into the global records: update each exercise's anchor (last working set) and best-ever estimated 1RM.
export function updateExerciseRecords(
  current: Record<string, ExerciseRecord>,
  exercises: { id: string; completedSets: LoggedSet[] }[],
  now: Date,
): Record<string, ExerciseRecord> {
  const next = { ...current };
  for (const ex of exercises) {
    const set = recordableSet(ex.completedSets);
    if (!set) continue;
    const est = e1rmLbs(set.weight, set.reps, set.unit);
    const prev = next[ex.id];
    const isBest = est >= (prev?.bestE1RMLbs ?? 0);
    next[ex.id] = {
      exerciseId: ex.id,
      isMainLift: isFeaturedLift(ex.id),
      weight: set.weight,        // anchor is always the latest session
      reps: set.reps,
      unit: set.unit,
      updatedAt: now,
      bestE1RMLbs: Math.max(prev?.bestE1RMLbs ?? 0, est),  // best only ever climbs
      bestE1RMAt: isBest ? now : prev?.bestE1RMAt,
    };
  }
  return next;
}
