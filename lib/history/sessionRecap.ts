// Turns raw workout history into "session recaps" — the data behind the Sessions
// feed, which reframes History from a stats dashboard into a reflective, re-livable
// record of each gym session. Pure: derives everything from the workouts + catalog,
// no storage/clock side effects (caller passes `now`).
import { buildSessionPRs, SessionPR } from '@/components/history/prSessions';
import { dayKeyOf, e1rmLbs } from '@/components/history/liftSeries';
import { buildExerciseStats } from '@/lib/history/exerciseStats';
import { gradeE1rm, LiftGrading, TierGrade } from '@/lib/history/liftProgress';
import { calculateWorkoutStats } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/workouts';
import { convertWeight, CustomExercise, GeneratedWorkout, TrackingType, WeightUnit } from '@/types';

export interface StandoutSet {
  name: string;   // exercise display name
  weight: number; // in the display unit
  reps: number;
  unit: WeightUnit;
  // The set graded against the published strength standards — the exact grading
  // path the lift board uses (gradeE1rm), so the hero and the rows above it can
  // never disagree about what tier a number is. Null when the lift has no real
  // standard or the profile lacks bodyweight/gender: no fake 50th-percentile tiers.
  tierInfo: TierGrade | null;
}

export interface SessionComparison {
  deltaVolumePct: number; // signed % vs the reference session
  refLabel: string;       // e.g. "last Push Day"
}

// One entry per exercise actually performed — "what happened in the workout",
// in workout order, each summarized by its top completed set.
export interface LineupItem {
  name: string;   // short display name (no equipment suffix)
  weight: number; // top set weight in the display unit; 0 for a bodyweight movement
  reps: number;   // reps of that top set
}

export interface SessionRecap {
  workout: GeneratedWorkout;
  title: string;
  headline: string | null;      // narrative beat, or null (then the standout carries the card)
  standout: StandoutSet | null; // the session's most impressive working set (the PR lift's if any, else highest e1RM)
  pr: SessionPR | null;         // the day's single most significant record, if any
  prGainDisplay: number;        // the PR's gain over the prior best, in the display unit (0 if no PR)
  volumeLbs: number;            // in lbs (stable), format at the edge
  volumeDisplay: number;        // in the display unit
  sets: number;
  durationMin: number;
  muscles: string[];            // primary muscles worked, most-hit first
  lineup: LineupItem[];         // every exercise performed, workout order, top set each
  comparison: SessionComparison | null;
}

/** Drop the trailing "(Equipment)" for a punchier headline. */
const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

const COMEBACK_MIN_DAYS = 7;
const DAY_MS = 86400000;

/** Primary muscles worked in a session, ordered by how many sets hit them. */
function sessionMuscles(workout: GeneratedWorkout): string[] {
  const counts = new Map<string, number>();
  for (const ex of workout.exercises) {
    const done = (ex.completedSets || []).filter(s => s.completed).length;
    if (done === 0) continue;
    const info = getExercise(ex.id);
    for (const m of info?.primaryMuscles || []) counts.set(m, (counts.get(m) || 0) + done);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

/**
 * The session's headline set. When the day set a record we show THAT lift's top set
 * (so the "Squat PR" headline and the big number agree); otherwise the single most
 * impressive working set by estimated 1RM. When the profile supports honest grading,
 * the winning set is graded through the same gradeE1rm path as the lift board, so
 * the hero can carry its earned tier ("e1RM 293 · 12 lbs to B+").
 */
function standoutSet(
  workout: GeneratedWorkout,
  unit: WeightUnit,
  grading: LiftGrading | null,
  preferName?: string,
): StandoutSet | null {
  let best: { e1rm: number; id: string; set: StandoutSet } | null = null;
  let preferred: { e1rm: number; id: string; set: StandoutSet } | null = null;
  for (const ex of workout.exercises) {
    const info = getExercise(ex.id);
    const trackingType: TrackingType = info?.trackingType || 'reps';
    if (trackingType !== 'reps') continue;
    const name = info?.name || ex.id.replace('custom_', '').replace(/-/g, ' ');
    for (const s of ex.completedSets || []) {
      if (!s.completed || (s.weight || 0) <= 0) continue;
      const lbs = e1rmLbs({ weight: s.weight, reps: s.reps, unit: s.unit });
      const set: StandoutSet = {
        name,
        weight: Math.round(convertWeight(s.weight, s.unit || 'lbs', unit)),
        reps: s.reps,
        unit,
        tierInfo: null,
      };
      if (!best || lbs > best.e1rm) best = { e1rm: lbs, id: ex.id, set };
      if (preferName && name === preferName && (!preferred || lbs > preferred.e1rm)) {
        preferred = { e1rm: lbs, id: ex.id, set };
      }
    }
  }
  const winner = preferred ?? best;
  if (!winner) return null;
  // Grade THIS session's set (not the all-time record) so the hero stays honest —
  // a lighter day really does read a lower e1RM / further from the next tier.
  const tierInfo = grading ? (gradeE1rm(winner.id, winner.e1rm, unit, grading) ?? null) : null;
  return { ...winner.set, tierInfo };
}

function volumeLbs(workout: GeneratedWorkout, getTrackingType: (id: string) => TrackingType | undefined): number {
  return calculateWorkoutStats(workout.exercises, getTrackingType).totalVolumeLbs;
}

/**
 * "What happened": every exercise with at least one completed set, in workout order,
 * summarized by its best completed set (highest e1RM; most reps for bodyweight work).
 */
function sessionLineup(workout: GeneratedWorkout, unit: WeightUnit): LineupItem[] {
  const out: LineupItem[] = [];
  for (const ex of workout.exercises) {
    const done = (ex.completedSets || []).filter(s => s.completed);
    if (done.length === 0) continue;
    const name = getExercise(ex.id)?.name || ex.id.replace('custom_', '').replace(/-/g, ' ');
    let top = done[0];
    let topScore = -1;
    for (const s of done) {
      const score = (s.weight || 0) > 0 ? e1rmLbs({ weight: s.weight, reps: s.reps, unit: s.unit }) : s.reps;
      if (score > topScore) { topScore = score; top = s; }
    }
    out.push({
      name: shortName(name),
      weight: (top.weight || 0) > 0 ? Math.round(convertWeight(top.weight, top.unit || 'lbs', unit)) : 0,
      reps: top.reps,
    });
  }
  return out;
}

/**
 * Build the recap list, newest first. Each recap gets a narrative headline chosen by
 * priority: major PR › comeback › biggest-of-its-kind › standard PR › none. Comparison
 * is volume vs the previous session of the same title (falls back to the previous
 * session overall).
 */
export function buildSessionRecaps(
  workouts: GeneratedWorkout[],
  customExercises: CustomExercise[],
  weightUnit: WeightUnit,
  grading: LiftGrading | null = null,
): SessionRecap[] {
  if (workouts.length === 0) return [];

  const getTrackingType = (id: string): TrackingType | undefined =>
    getExercise(id)?.trackingType;

  // Records key off the same day-grouped exercise stats the rest of History uses.
  const stats = buildExerciseStats(workouts, customExercises, weightUnit);
  const sessionPRs = buildSessionPRs(stats);

  // Oldest → newest so "biggest yet" / comeback can look back at what came before.
  const chron = [...workouts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const vol = new Map<string, number>(); // workout.id → volume (lbs)
  chron.forEach(w => vol.set(w.id, volumeLbs(w, getTrackingType)));

  const recaps: SessionRecap[] = chron.map((workout, i) => {
    const prior = chron.slice(0, i);
    const sameTitlePrior = prior.filter(w => w.title === workout.title);
    const myVol = vol.get(workout.id) || 0;

    // Comparison: same-title previous session, else the immediately previous session.
    const ref = sameTitlePrior[sameTitlePrior.length - 1] ?? prior[prior.length - 1] ?? null;
    let comparison: SessionComparison | null = null;
    if (ref) {
      const refVol = vol.get(ref.id) || 0;
      if (refVol > 0) {
        comparison = {
          deltaVolumePct: Math.round(((myVol - refVol) / refVol) * 100),
          refLabel: ref.title === workout.title ? `last ${workout.title}` : `last session`,
        };
      }
    }

    const pr = sessionPRs.get(dayKeyOf(workout.createdAt)) ?? null;
    const standout = standoutSet(workout, weightUnit, grading, pr?.name);
    const wStats = calculateWorkoutStats(workout.exercises, getTrackingType);

    // Gap since the previous session of any kind (drives the comeback beat).
    const prevDate = prior.length ? new Date(prior[prior.length - 1].createdAt) : null;
    const gapDays = prevDate
      ? Math.round((new Date(workout.createdAt).getTime() - prevDate.getTime()) / DAY_MS)
      : 0;

    // Biggest-of-its-kind: this session's volume beats every prior same-title session.
    const isBiggestOfKind =
      sameTitlePrior.length > 0 && sameTitlePrior.every(w => (vol.get(w.id) || 0) < myVol);

    let headline: string | null = null;
    if (pr?.tier === 'major') {
      headline = `New ${shortName(pr.name)} PR`;
    } else if (gapDays >= COMEBACK_MIN_DAYS) {
      headline = `Back after ${gapDays} days off`;
    } else if (isBiggestOfKind) {
      headline = `Biggest ${workout.title} yet`;
    } else if (pr) {
      headline = `${shortName(pr.name)} PR`;
    }

    return {
      workout,
      title: workout.title,
      headline,
      standout,
      pr,
      prGainDisplay: pr ? Math.max(1, Math.round(convertWeight(pr.gainLbs, 'lbs', weightUnit))) : 0,
      volumeLbs: myVol,
      volumeDisplay: Math.round(convertWeight(myVol, 'lbs', weightUnit)),
      sets: wStats.totalSets,
      durationMin: workout.estimatedDuration || 0,
      muscles: sessionMuscles(workout),
      lineup: sessionLineup(workout, weightUnit),
      comparison,
    };
  });

  return recaps.reverse(); // newest first for the feed
}
