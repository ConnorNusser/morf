/**
 * Deterministic synthetic history states — the "scenarios" the loop hardens against.
 *
 * Every fixture is anchored to REFERENCE_NOW so week/streak/period derivations are
 * testable without a live clock. Fixtures are plain data (GeneratedWorkout[]); the
 * golden expected values live in goldens.ts and are computed INDEPENDENTLY of the
 * app's own functions so the correctness gate is a real check, not a tautology.
 */
import { GeneratedWorkout, WorkoutExerciseSession, WorkoutSetCompletion, WeightUnit } from '@/types';

/** Fixed "now" every fixture is relative to. Sat 2024-06-15 12:00 UTC. */
export const REFERENCE_NOW = new Date('2024-06-15T12:00:00Z');

const DAY = 24 * 60 * 60 * 1000;
/** A date `daysAgo` before REFERENCE_NOW. */
export const daysAgo = (n: number): Date => new Date(REFERENCE_NOW.getTime() - n * DAY);

type SetSpec = [weight: number, reps: number, unit?: WeightUnit];

const mkSets = (specs: SetSpec[]): WorkoutSetCompletion[] =>
  specs.map(([weight, reps, unit = 'lbs'], i) => ({
    setNumber: i + 1,
    weight,
    reps,
    unit,
    completed: true,
  }));

const mkExercise = (id: string, specs: SetSpec[]): WorkoutExerciseSession => ({
  id,
  sets: specs.length,
  reps: '8-10',
  completedSets: mkSets(specs),
  isCompleted: true,
});

let seq = 0;
const mkWorkout = (
  createdAt: Date,
  title: string,
  exercises: WorkoutExerciseSession[]
): GeneratedWorkout => ({
  id: `w-${(seq++).toString().padStart(4, '0')}`,
  title,
  description: '',
  exercises,
  estimatedDuration: 45,
  difficulty: 'moderate',
  createdAt,
});

// ── Scenarios ──────────────────────────────────────────────────────────────

/** New user — the cold-start empty state. */
const empty: GeneratedWorkout[] = [];

/** Exactly one workout, logged today. Hero (needs ≥3 sessions/lift) must stay empty. */
const single: GeneratedWorkout[] = [
  mkWorkout(daysAgo(0), 'Push Day', [
    mkExercise('bench-press-barbell', [[135, 10], [155, 8], [155, 8]]),
    mkExercise('overhead-press-barbell', [[75, 10], [85, 8]]),
  ]),
];

/** Sparse & gappy — 3 workouts over ~2 months. Breaks streak, thin per-lift history. */
const sparse: GeneratedWorkout[] = [
  mkWorkout(daysAgo(58), 'Full Body', [mkExercise('squat-barbell', [[185, 5], [205, 5]])]),
  mkWorkout(daysAgo(30), 'Full Body', [mkExercise('squat-barbell', [[195, 5], [215, 5]])]),
  mkWorkout(daysAgo(5), 'Full Body', [mkExercise('squat-barbell', [[205, 5], [225, 5]])]),
];

/** Lapsed — trained consistently, then nothing for 45 days. Comeback/empty-week state. */
const lapsed: GeneratedWorkout[] = [
  mkWorkout(daysAgo(52), 'Pull Day', [mkExercise('deadlift-barbell', [[275, 5], [315, 3]])]),
  mkWorkout(daysAgo(49), 'Push Day', [mkExercise('bench-press-barbell', [[155, 8], [175, 5]])]),
  mkWorkout(daysAgo(45), 'Leg Day', [mkExercise('squat-barbell', [[225, 5], [245, 3]])]),
];

/** Logged in kilograms — exercises the kg→lbs volume conversion path. */
const kgUnit: GeneratedWorkout[] = [
  mkWorkout(daysAgo(2), 'Push Day', [
    mkExercise('bench-press-barbell', [[60, 10, 'kg'], [70, 8, 'kg'], [70, 8, 'kg']]),
  ]),
];

/** Bodyweight — weight 0 must be skipped from volume/1RM, not render NaN. */
const bodyweight: GeneratedWorkout[] = [
  mkWorkout(daysAgo(1), 'Calisthenics', [
    mkExercise('pull-up', [[0, 12], [0, 10], [0, 8]]),
    mkExercise('push-up', [[0, 20], [0, 18]]),
  ]),
];

/** PR-heavy — strictly ascending top sets across many sessions → lots of PR flags + hero curve. */
const prHeavy: GeneratedWorkout[] = Array.from({ length: 8 }, (_, i) =>
  mkWorkout(daysAgo(56 - i * 7), 'Bench Focus', [
    mkExercise('bench-press-barbell', [[135, 8], [155 + i * 5, 6], [155 + i * 5, 5]]),
  ])
);

/** Dense — 150 workouts for perf/virtualization stress on mount + scroll. */
const dense: GeneratedWorkout[] = Array.from({ length: 150 }, (_, i) =>
  mkWorkout(daysAgo(150 - i), i % 2 === 0 ? 'Push Day' : 'Pull Day', [
    mkExercise('bench-press-barbell', [[135 + (i % 20), 8], [155 + (i % 20), 6]]),
    mkExercise('barbell-row', [[135 + (i % 15), 8], [145 + (i % 15), 8]]),
  ])
);

/** Corrupt/partial — missing completedSets, empty exercises, undefined units. Must not throw. */
const corrupt: GeneratedWorkout[] = [
  {
    id: 'w-corrupt-1',
    title: 'Partial',
    description: '',
    exercises: [
      { id: 'bench-press-barbell', sets: 3, reps: '8', completedSets: [], isCompleted: false },
      // set with unit omitted (legacy) — should default to lbs
      {
        id: 'squat-barbell',
        sets: 1,
        reps: '5',
        completedSets: [{ setNumber: 1, weight: 225, reps: 5, completed: true } as WorkoutSetCompletion],
        isCompleted: true,
      },
    ],
    estimatedDuration: 30,
    difficulty: 'moderate',
    createdAt: daysAgo(3),
  },
];

export interface Scenario {
  key: string;
  description: string;
  workouts: GeneratedWorkout[];
}

export const SCENARIOS: Scenario[] = [
  { key: 'empty', description: 'New user, zero workouts — cold-start empty state.', workouts: empty },
  { key: 'single', description: 'One workout today — hero must stay hidden (needs ≥3 sessions).', workouts: single },
  { key: 'sparse', description: '3 workouts over ~2 months with gaps — broken streak, thin history.', workouts: sparse },
  { key: 'lapsed', description: 'Consistent then 45-day gap — comeback / empty current week.', workouts: lapsed },
  { key: 'kgUnit', description: 'Logged in kg — kg→lbs volume conversion.', workouts: kgUnit },
  { key: 'bodyweight', description: 'Weight-0 bodyweight sets — skipped from volume/1RM, no NaN.', workouts: bodyweight },
  { key: 'prHeavy', description: 'Ascending top sets across 8 sessions — many PRs + hero curve.', workouts: prHeavy },
  { key: 'dense', description: '150 workouts — perf/scroll stress.', workouts: dense },
  { key: 'corrupt', description: 'Missing completedSets, empty exercises, undefined units — must not throw.', workouts: corrupt },
];

export const scenarioByKey = (key: string): Scenario => {
  const s = SCENARIOS.find((x) => x.key === key);
  if (!s) throw new Error(`unknown scenario: ${key}`);
  return s;
};
