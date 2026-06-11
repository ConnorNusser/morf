// Golden-set calibration: proven, real-world programs encoded with DB exercise
// ids. The rubric MUST score each ≥90 under its intended goal. If a future rule
// change drops a known-good program below 90, the RULE is wrong — not the program.
// This is the guardrail that stops the scorer drifting into pseudo-science.
import { Routine } from '@/types';
import { summarizeQuality, validateRoutineQuality } from '../routineQuality';

// [exerciseId, sets, reps][] → a training day
type E = [string, number, number];
const d = (name: string, exs: E[]): Routine => ({
  id: name,
  name,
  exercises: exs.map(([id, sets, reps]) => ({
    exerciseId: id,
    sets: Array.from({ length: sets }, () => ({ reps })),
  })),
  createdAt: new Date(0),
} as Routine);

// --- Starting Strength (3-day A/B/A, strength) ---
const SS_A = d('Workout A', [
  ['squat-barbell', 3, 5],
  ['bench-press-barbell', 3, 5],
  ['deadlift-barbell', 1, 5],
]);
const SS_B = d('Workout B', [
  ['squat-barbell', 3, 5],
  ['overhead-press-barbell', 3, 5],
  ['deadlift-barbell', 1, 5],
]);
const STARTING_STRENGTH = [SS_A, SS_B, SS_A];

// --- PHUL (4-day, powerbuilding) ---
const PHUL = [
  d('Upper Power', [
    ['bench-press-barbell', 3, 5],
    ['row-barbell', 3, 5],
    ['overhead-press-barbell', 3, 6],
    ['pull-up-bodyweight', 3, 6],
    ['lateral-raise-dumbbells', 3, 12],
    ['tricep-pushdown-cables', 3, 8],
    ['bicep-curl-barbell', 3, 8],
  ]),
  d('Lower Power', [
    ['squat-barbell', 3, 5],
    ['deadlift-barbell', 3, 5],
    ['leg-press-machine', 3, 8],
    ['leg-curl-machine', 3, 8],
    ['calf-raise-machine', 4, 10],
  ]),
  d('Upper Hypertrophy', [
    ['incline-bench-press-dumbbells', 3, 10],
    ['seated-row-machine', 3, 10],
    ['lateral-raise-dumbbells', 4, 12],
    ['chest-fly-cables', 3, 12],
    ['bicep-curl-cables', 3, 12],
    ['tricep-extension-dumbbells', 3, 12],
  ]),
  d('Lower Hypertrophy', [
    ['front-squat-barbell', 3, 10],
    ['romanian-deadlift-barbell', 3, 10],
    ['leg-extension-machine', 4, 12],
    ['leg-curl-machine', 4, 12],
    ['calf-raise-machine', 4, 15],
  ]),
];

// --- Reddit PPL (6-day, hypertrophy) ---
const REDDIT_PPL = [
  d('Push A', [
    ['bench-press-barbell', 4, 5],
    ['overhead-press-barbell', 3, 8],
    ['incline-bench-press-dumbbells', 3, 10],
    ['lateral-raise-dumbbells', 4, 12],
    ['tricep-pushdown-cables', 3, 10],
  ]),
  d('Pull A', [
    ['deadlift-barbell', 1, 5],
    ['pull-up-bodyweight', 3, 6],
    ['row-barbell', 3, 8],
    ['lat-pulldown-cables', 3, 10],
    ['bicep-curl-barbell', 3, 10],
    ['hammer-curl-dumbbells', 3, 12],
  ]),
  d('Legs A', [
    ['squat-barbell', 3, 5],
    ['romanian-deadlift-barbell', 3, 8],
    ['leg-press-machine', 3, 10],
    ['leg-curl-machine', 3, 10],
    ['calf-raise-machine', 4, 12],
  ]),
  d('Push B', [
    ['overhead-press-barbell', 4, 5],
    ['incline-bench-press-barbell', 3, 8],
    ['dip-bodyweight', 3, 10],
    ['lateral-raise-dumbbells', 4, 12],
    ['tricep-extension-dumbbells', 3, 12],
  ]),
  d('Pull B', [
    ['row-barbell', 4, 5],
    ['seated-row-machine', 3, 8],
    ['lat-pulldown-cables', 3, 10],
    ['rear-delt-fly-dumbbells', 3, 12],
    ['bicep-curl-barbell', 3, 10],
    ['preacher-curl-dumbbells', 3, 12],
  ]),
  d('Legs B', [
    ['front-squat-barbell', 3, 5],
    ['hip-thrust-barbell', 3, 8],
    ['leg-extension-machine', 4, 12],
    ['leg-curl-machine', 3, 10],
    ['calf-raise-machine', 4, 15],
  ]),
];

const GOLDEN: { name: string; program: Routine[]; goal: string }[] = [
  { name: 'Starting Strength', program: STARTING_STRENGTH, goal: 'strength' },
  { name: 'PHUL', program: PHUL, goal: 'powerbuilding' },
  { name: 'Reddit PPL', program: REDDIT_PPL, goal: 'hypertrophy' },
];

describe('golden-set calibration', () => {
  for (const { name, program, goal } of GOLDEN) {
    it(`${name} scores >= 90 as ${goal}`, () => {
      const r = validateRoutineQuality(program, { goal });
      if (r.score < 90) {
        // Surface why, so a regression is debuggable at a glance.
        console.error(`${name}: ${summarizeQuality(r)}\n` + r.issues.map(i => `  ${i.severity} ${i.code}: ${i.message}`).join('\n'));
      }
      expect(r.score).toBeGreaterThanOrEqual(90);
      expect(r.passed).toBe(true);
    });
  }
});
