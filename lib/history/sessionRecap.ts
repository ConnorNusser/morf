// Turns raw workout history into the "session recaps" behind the Sessions feed. Pure.
import { buildSessionPRs, SessionPR } from '@/components/history/prSessions';
import { dayKeyOf, e1rmLbs } from '@/components/history/liftSeries';
import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';
import { buildExerciseStats } from '@/lib/history/exerciseStats';
import { gradeE1rm, LiftGrading, TierGrade } from '@/lib/history/liftProgress';
import { calculateWorkoutStats } from '@/lib/utils/utils';
import { getExercise } from '@/lib/workout/exerciseCatalog';
import { convertWeight, CustomExercise, LoggedWorkout, MuscleGroup, TrackingType, WeightUnit } from '@/types';

export interface StandoutSet {
  name: string;
  weight: number; // display unit
  reps: number;
  unit: WeightUnit;
  e1rm: number; // display unit, rounded — powers the compact feed row
  // Null when no real standard or profile lacks bodyweight/gender: no fake 50th-pct tiers.
  tierInfo: TierGrade | null;
}

export interface SessionComparison {
  deltaVolumePct: number; // signed % vs the reference session
  refLabel: string;
}

export interface LineupItem {
  name: string; // no equipment suffix
  weight: number; // display unit; 0 for bodyweight
  reps: number;
  sets: number;
}

export interface SessionRecap {
  workout: LoggedWorkout;
  title: string;
  headline: string | null;
  standout: StandoutSet | null; // PR lift's set if any, else highest e1RM
  pr: SessionPR | null;
  prGainDisplay: number; // display unit, 0 if no PR
  volumeLbs: number; // lbs
  volumeDisplay: number;
  sets: number;
  durationMin: number;
  muscles: string[]; // most-hit first
  split: PPLCategory | null;
  lineup: LineupItem[];
  comparison: SessionComparison | null;
}

// Drop trailing "(Equipment)".
const shortName = (s: string) => s.replace(/\s*\([^)]*\)\s*$/, '').trim();

const COMEBACK_MIN_DAYS = 7;
const DAY_MS = 86400000;

// Primary muscles, ordered by sets hitting them.
function sessionMuscles(workout: LoggedWorkout): MuscleGroup[] {
  const counts = new Map<MuscleGroup, number>();
  for (const ex of workout.exercises) {
    const done = (ex.completedSets || []).filter(s => s.completed).length;
    if (done === 0) continue;
    const info = getExercise(ex.id);
    for (const m of info?.primaryMuscles || []) counts.set(m, (counts.get(m) || 0) + done);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([m]) => m);
}

// PR lift's top set when the day set a record (headline and number agree), else highest e1RM.
function standoutSet(
  workout: LoggedWorkout,
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
        e1rm: Math.round(convertWeight(lbs, 'lbs', unit)),
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
  // Grade THIS session's set (not all-time) so a lighter day reads lower.
  const tierInfo = grading ? (gradeE1rm(winner.id, winner.e1rm, unit, grading) ?? null) : null;
  return { ...winner.set, tierInfo };
}

function volumeLbs(workout: LoggedWorkout, getTrackingType: (id: string) => TrackingType | undefined): number {
  return calculateWorkoutStats(workout.exercises, getTrackingType).totalVolumeLbs;
}

// Best set per exercise (e1RM; reps for bodyweight), workout order.
function sessionLineup(workout: LoggedWorkout, unit: WeightUnit): LineupItem[] {
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
      sets: done.length,
    });
  }
  return out;
}

// Newest first. Headline priority: major PR › comeback › biggest-of-its-kind › PR › none.
export function buildSessionRecaps(
  workouts: LoggedWorkout[],
  customExercises: CustomExercise[],
  weightUnit: WeightUnit,
  grading: LiftGrading | null = null,
): SessionRecap[] {
  if (workouts.length === 0) return [];

  const getTrackingType = (id: string): TrackingType | undefined =>
    getExercise(id)?.trackingType;

  const stats = buildExerciseStats(workouts, customExercises, weightUnit);
  const sessionPRs = buildSessionPRs(stats);

  // Oldest→newest so "biggest yet" / comeback can look back.
  const chron = [...workouts].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const vol = new Map<string, number>(); // workout.id → volume (lbs)
  chron.forEach(w => vol.set(w.id, volumeLbs(w, getTrackingType)));

  const recaps: SessionRecap[] = chron.map((workout, i) => {
    const prior = chron.slice(0, i);
    const sameTitlePrior = prior.filter(w => w.title === workout.title);
    const myVol = vol.get(workout.id) || 0;

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
    const muscles = sessionMuscles(workout);

    // Gap driving the comeback beat.
    const prevDate = prior.length ? new Date(prior[prior.length - 1].createdAt) : null;
    const gapDays = prevDate
      ? Math.round((new Date(workout.createdAt).getTime() - prevDate.getTime()) / DAY_MS)
      : 0;

    // Beats every prior same-title session.
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
      muscles,
      split: muscles.length > 0 ? (MUSCLE_TO_PPL[muscles[0]] ?? null) : null,
      lineup: sessionLineup(workout, weightUnit),
      comparison,
    };
  });

  return recaps.reverse(); // newest first
}
