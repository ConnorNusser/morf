// Routine generation QUALITY validation — scores a generated program against the
// schemas real lifters / bodybuilders follow, so we can catch low-quality
// generations (junk ordering, missing muscle groups, push/pull imbalance, absurd
// volume) before they reach the user. Pure + derived from the exercise DB, so it
// has no side effects and is fully unit-testable.
//
// Design note: checks are intentionally chosen to be robust against the exercise
// DB's coarse muscle labels (e.g. "legs" spans quads/hams/glutes). We flag total
// gaps and week-level imbalance — NOT fine-grained per-muscle set counts, which
// would false-positive on every normal training day.
import { MUSCLE_TO_PPL, PPLCategory } from '@/lib/data/pplCategories';
import { ALL_SUBMUSCLES, getSubMuscles, SubMuscle } from '@/lib/data/muscleTaxonomy';
import { MuscleGroup, Routine, WorkoutCategory } from '@/types';
import { getWorkoutById } from './workouts';

export type IssueSeverity = 'error' | 'warning' | 'info';

export interface RoutineQualityIssue {
  severity: IssueSeverity;
  code: string;
  message: string;
  day?: string; // the day/routine name, when the issue is day-scoped
}

export interface RoutineQualityReport {
  score: number; // 0..100, starts at 100 and loses points per issue
  passed: boolean; // no errors AND score >= PASS_THRESHOLD
  issues: RoutineQualityIssue[];
}

export const PASS_THRESHOLD = 70;
const PENALTY: Record<IssueSeverity, number> = { error: 30, warning: 10, info: 3 };

// Big movers whose total absence across a week is a genuine red flag. arms /
// glutes / core are usually trained as secondaries, so we don't flag their
// absence (that would be noisy).
const MAJOR_MUSCLES: MuscleGroup[] = ['chest', 'back', 'legs', 'shoulders'];

// Weekly per-muscle volume / frequency landmarks, by training goal. mev = minimum
// effective volume (sets/muscle/week), mrv = maximum recoverable volume, freq =
// recommended sessions/muscle/week. Tunable in one place; calibrated against the
// golden-set programs (see goldenRoutines test) so they never flag known-good work.
interface VolumeLandmark { mev: number; mrv: number; freq: number; }
const VOLUME_BY_GOAL: Record<string, VolumeLandmark> = {
  hypertrophy: { mev: 8, mrv: 22, freq: 2 },
  strength: { mev: 4, mrv: 18, freq: 1 },
  powerbuilding: { mev: 6, mrv: 20, freq: 2 },
  endurance: { mev: 4, mrv: 24, freq: 1 },
  general: { mev: 4, mrv: 22, freq: 1 },
};
const DEFAULT_LANDMARK = VOLUME_BY_GOAL.general;

// Sub-muscles we hold to volume/frequency standards. Stabilizers and small muscles
// trained mostly indirectly (forearms, abs, calves, traps, lower_back, upper_back,
// rear_delts) are excluded — flagging their volume is noisy and over-strict.
const MAJOR_SUBMUSCLES: SubMuscle[] = [
  'quads', 'hamstrings', 'glutes', 'chest', 'lats', 'front_delts', 'side_delts', 'biceps', 'triceps',
];

const SUBMUSCLE_LABEL: Record<SubMuscle, string> = {
  quads: 'Quads', hamstrings: 'Hamstrings', glutes: 'Glutes', calves: 'Calves',
  chest: 'Chest', front_delts: 'Front delts', side_delts: 'Side delts', rear_delts: 'Rear delts',
  lats: 'Lats', upper_back: 'Upper back', traps: 'Traps', lower_back: 'Lower back',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Forearms', abs: 'Abs',
};

// Each issue code's scientific basis — for tuning, docs and surfacing "why".
export const RUBRIC: Record<string, { source: string; about: string }> = {
  ordering: { source: 'ACSM position stand (2009)', about: 'Multi-joint before single-joint' },
  'no-compound': { source: 'NSCA Essentials', about: 'Anchor each session with a compound' },
  'muscle-gap': { source: 'Balanced programming', about: 'Train every major mover weekly' },
  'push-pull-imbalance': { source: 'Antagonist balance', about: 'Keep push/pull volume even' },
  'under-volume': { source: 'Schoenfeld 2017; RP volume landmarks', about: 'Weekly sets ≥ MEV' },
  'over-volume': { source: 'RP MRV', about: 'Weekly sets ≤ MRV' },
  'low-frequency': { source: 'Schoenfeld 2016 meta', about: '≥2×/week per muscle for hypertrophy' },
  'low-volume': { source: 'Session sanity', about: 'Enough working sets per session' },
  'high-volume': { source: 'Session sanity', about: 'Not too many sets per session' },
  'rep-range': { source: 'Rep sanity', about: '1–30 reps' },
};

// Whether an exercise contributes working sets to volume (reps-tracked only).
function countsForVolume(exerciseId: string): boolean {
  const t = getWorkoutById(exerciseId)?.trackingType ?? 'reps';
  return t === 'reps';
}

// Weekly sets per sub-muscle: primary movers get full credit, secondary half (RP).
export function setsPerSubMuscle(program: Routine[]): Record<SubMuscle, number> {
  const out = Object.fromEntries(ALL_SUBMUSCLES.map(s => [s, 0])) as Record<SubMuscle, number>;
  for (const day of program) {
    for (const ex of day.exercises || []) {
      if (!countsForVolume(ex.exerciseId)) continue;
      const working = (ex.sets || []).filter(s => !s.isWarmup).length;
      if (!working) continue;
      const t = getSubMuscles(ex.exerciseId, getWorkoutById(ex.exerciseId)?.primaryMuscles);
      for (const m of t.primary) out[m] += working;
      for (const m of t.secondary) out[m] += working * 0.5;
    }
  }
  return out;
}

// Sessions per week each sub-muscle is a *primary* mover in.
export function frequencyPerSubMuscle(program: Routine[]): Record<SubMuscle, number> {
  const out = Object.fromEntries(ALL_SUBMUSCLES.map(s => [s, 0])) as Record<SubMuscle, number>;
  for (const day of program) {
    const hit = new Set<SubMuscle>();
    for (const ex of day.exercises || []) {
      if (!countsForVolume(ex.exerciseId)) continue;
      if (!(ex.sets || []).some(s => !s.isWarmup)) continue;
      getSubMuscles(ex.exerciseId, getWorkoutById(ex.exerciseId)?.primaryMuscles).primary.forEach(m => hit.add(m));
    }
    hit.forEach(m => (out[m] += 1));
  }
  return out;
}

interface ResolvedExercise {
  name: string;
  category: WorkoutCategory | null; // null when the id isn't in the built-in DB (custom)
  primary: MuscleGroup[];
  workingSets: number;
  reps: number[]; // working-set reps only
  trackingType: string;
}

function resolve(ex: RoutineExerciseShape): ResolvedExercise {
  const meta = getWorkoutById(ex.exerciseId);
  const working = (ex.sets || []).filter(s => !s.isWarmup);
  return {
    name: meta?.name ?? ex.exerciseName ?? ex.exerciseId,
    category: meta?.category ?? null,
    primary: meta?.primaryMuscles ?? [],
    workingSets: working.length,
    reps: working.map(s => s.reps),
    trackingType: meta?.trackingType ?? 'reps',
  };
}

// Loosened shape so callers can pass either a saved Routine or a freshly-converted
// one without fighting optional fields.
type RoutineExerciseShape = Routine['exercises'][number];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function finalize(issues: RoutineQualityIssue[]): RoutineQualityReport {
  const lost = issues.reduce((sum, i) => sum + PENALTY[i.severity], 0);
  const score = Math.max(0, Math.min(100, 100 - lost));
  const passed = !issues.some(i => i.severity === 'error') && score >= PASS_THRESHOLD;
  return { score, passed, issues };
}

export function validateRoutineQuality(
  program: Routine[],
  opts: { goal?: string } = {},
): RoutineQualityReport {
  const issues: RoutineQualityIssue[] = [];
  const add = (severity: IssueSeverity, code: string, message: string, day?: string) =>
    issues.push({ severity, code, message, day });

  if (program.length === 0) {
    add('error', 'empty-program', 'The program has no training days.');
    return finalize(issues);
  }
  if (program.length > 7) {
    add('warning', 'too-many-days', `${program.length} days in a week exceeds a 7-day week.`);
  }

  // Week-level aggregates, built from each day's primary-muscle work.
  const muscleSets = new Map<MuscleGroup, number>();
  const pplSets: Record<PPLCategory, number> = { push: 0, pull: 0, legs: 0 };

  for (const day of program) {
    const dayName = day.name || (day.splitType ? cap(day.splitType) : 'A day');
    const resolved = (day.exercises || []).map(resolve);

    if (resolved.length === 0) {
      add('error', 'empty-day', `"${dayName}" has no exercises.`, dayName);
      continue;
    }

    const strength = resolved.filter(r => r.category === 'compound' || r.category === 'isolation');

    // A strength day with multiple lifts but no compound is all-isolation junk.
    if (strength.length >= 2 && !strength.some(r => r.category === 'compound')) {
      add('warning', 'no-compound', `"${dayName}" has no compound lift — it's all isolation work.`, dayName);
    }

    // Compounds should precede isolation (heaviest, most technical work while fresh).
    let firstIsolation: string | null = null;
    for (const r of resolved) {
      if (r.category === 'isolation') firstIsolation ??= r.name;
      else if (r.category === 'compound' && firstIsolation) {
        add('warning', 'ordering', `"${dayName}" places isolation (${firstIsolation}) before the compound ${r.name} — compounds should come first.`, dayName);
        break;
      }
    }

    // Per-session working volume.
    const dayWorkingSets = resolved.reduce((n, r) => n + r.workingSets, 0);
    if (dayWorkingSets < 6) {
      add('warning', 'low-volume', `"${dayName}" has only ${dayWorkingSets} working sets — light for a full session.`, dayName);
    } else if (dayWorkingSets > 32) {
      add('warning', 'high-volume', `"${dayName}" has ${dayWorkingSets} working sets — unrealistically high for one session.`, dayName);
    }

    // Rep prescriptions should land in a sane hypertrophy/strength range.
    for (const r of resolved) {
      if (r.trackingType !== 'reps') continue; // skip timed / cardio
      if (r.reps.some(reps => reps < 1 || reps > 30)) {
        add('warning', 'rep-range', `${r.name} in "${dayName}" prescribes reps outside the normal 1–30 range.`, dayName);
      }
    }

    for (const r of strength) {
      const primary = r.primary[0];
      if (!primary) continue;
      muscleSets.set(primary, (muscleSets.get(primary) ?? 0) + r.workingSets);
      const ppl = MUSCLE_TO_PPL[primary];
      if (ppl) pplSets[ppl] += r.workingSets;
    }
  }

  // Every major mover should be hit at least once in the week.
  for (const m of MAJOR_MUSCLES) {
    if (!muscleSets.get(m)) {
      add('warning', 'muscle-gap', `${cap(m)} is never trained across the week.`);
    }
  }

  // Push/pull antagonist balance (legs excluded — it's its own axis).
  const { push, pull } = pplSets;
  if (push > 0 && pull > 0) {
    const ratio = Math.max(push, pull) / Math.min(push, pull);
    if (ratio >= 2) {
      add('warning', 'push-pull-imbalance', `Push/pull volume is imbalanced (${push} push vs ${pull} pull sets).`);
    }
  } else if (push > 0 || pull > 0) {
    const present = push > 0 ? 'push' : 'pull';
    const missing = push > 0 ? 'pull' : 'push';
    add('warning', 'push-pull-imbalance', `The week trains ${present} but no ${missing} — antagonist imbalance.`);
  }

  // Per-muscle weekly volume & frequency vs goal landmarks (MEV→MRV, ≥2×/wk).
  const lm = VOLUME_BY_GOAL[(opts.goal || 'general').toLowerCase()] ?? DEFAULT_LANDMARK;
  const volume = setsPerSubMuscle(program);
  const freq = frequencyPerSubMuscle(program);
  for (const m of MAJOR_SUBMUSCLES) {
    // Only judge muscles the program actually targets as a primary mover. A muscle
    // hit only secondarily (or not at all) is an exercise-selection choice, not
    // "under-volume" — and keeps minimalist strength programs from false-flagging.
    if (freq[m] < 1) continue;
    const sets = Math.round(volume[m] * 10) / 10;
    if (sets < lm.mev) {
      add('warning', 'under-volume', `${SUBMUSCLE_LABEL[m]} gets only ${sets} weekly sets — below the ~${lm.mev}-set minimum.`);
    } else if (sets > lm.mrv) {
      add('warning', 'over-volume', `${SUBMUSCLE_LABEL[m]} gets ${sets} weekly sets — above the ~${lm.mrv}-set recoverable max.`);
    }
    if (lm.freq >= 2 && sets >= lm.mev && freq[m] < lm.freq) {
      add('info', 'low-frequency', `${SUBMUSCLE_LABEL[m]} is trained ${freq[m]}×/week — ${lm.freq}× is recommended for this goal.`);
    }
  }

  return finalize(issues);
}

// One-line human summary, handy for logs and the generator gate.
export function summarizeQuality(report: RoutineQualityReport): string {
  if (report.issues.length === 0) return `Quality ${report.score}/100 — clean.`;
  const errors = report.issues.filter(i => i.severity === 'error').length;
  const warnings = report.issues.filter(i => i.severity === 'warning').length;
  const parts = [];
  if (errors) parts.push(`${errors} error${errors > 1 ? 's' : ''}`);
  if (warnings) parts.push(`${warnings} warning${warnings > 1 ? 's' : ''}`);
  return `Quality ${report.score}/100 (${report.passed ? 'pass' : 'fail'}) — ${parts.join(', ')}.`;
}
