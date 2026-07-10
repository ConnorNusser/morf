import { calculateRoutine, getRoutineAnchor } from '@/lib/workout/progressiveOverload';
import { updateExerciseRecords } from '@/lib/workout/progression';
import { buildDraft, draftToRoutineExercises, routineDiffersFromDraft, removeSet } from '@/lib/workout/workoutDraft';
import { OneRMCalculator } from '@/lib/data/strengthStandards';
import type { ParsedWorkout } from '@/lib/workout/workoutNoteParser';
import type { CalculatedRoutine, ExerciseRecord, GeneratedWorkout, Routine } from '@/types';

const BENCH = 'bench-press-barbell';

const day = (id: string, name: string, reps: number, exerciseId = BENCH): Routine =>
  ({
    id,
    name,
    createdAt: new Date('2026-01-01'),
    exercises: [
      { exerciseId, exerciseName: 'Bench Press (Barbell)', sets: [{ reps }, { reps }, { reps }] },
    ],
  }) as Routine;

const session = (
  routineId: string | undefined,
  sets: [number, number][],
  daysAgo: number,
  exerciseId = BENCH,
): GeneratedWorkout =>
  ({
    id: `w_${routineId ?? 'freestyle'}_${daysAgo}`,
    createdAt: new Date(Date.UTC(2026, 5, 30 - daysAgo)),
    routineId,
    exercises: [
      {
        id: exerciseId,
        completedSets: sets.map(([weight, reps], i) => ({
          setNumber: i + 1,
          weight,
          reps,
          unit: 'lbs' as const,
          completed: true,
        })),
      },
    ],
  }) as GeneratedWorkout;

const record = (weight: number, reps: number): ExerciseRecord => ({
  exerciseId: BENCH,
  isMainLift: true,
  weight,
  reps,
  unit: 'lbs',
  updatedAt: new Date('2026-06-29'),
  bestE1RMLbs: OneRMCalculator.estimate(weight, reps),
});

const target = (calc: CalculatedRoutine) => ({
  weight: calc.exercises[0].workingWeight,
  reps: calc.exercises[0].sets.find(s => !s.isWarmup)?.reps ?? 0,
});

describe('per-routine anchoring', () => {
  it('anchors each routine to its own last session, not the global record', () => {
    const heavy = day('heavy', 'Heavy 3×5', 5);
    const history = [session('heavy', [[225, 5], [225, 5], [225, 5]], 3)];
    // Global record has since been overwritten by lighter work elsewhere.
    const records = { [BENCH]: record(135, 20) };

    const t = target(calculateRoutine(heavy, records, 'lbs', history));
    expect(t.weight).toBe(225);
    expect(t.reps).toBe(6); // hit the floor last time → chase one more rep
  });

  it('a freestyle session cannot move a routine target', () => {
    const heavy = day('heavy', 'Heavy 3×5', 5);
    const history = [
      session('heavy', [[225, 5], [225, 5], [225, 5]], 3),
      session(undefined, [[95, 20], [95, 20]], 1), // burnout day, no routineId
    ];
    let records: Record<string, ExerciseRecord> = { [BENCH]: record(225, 5) };
    records = updateExerciseRecords(records, [
      { id: BENCH, completedSets: [{ weight: 95, reps: 20, unit: 'lbs', completed: true }, { weight: 95, reps: 20, unit: 'lbs', completed: true }] },
    ], new Date('2026-06-29'));

    const t = target(calculateRoutine(heavy, records, 'lbs', history));
    expect(t.weight).toBe(225);
  });

  it('getRoutineAnchor reads the most recent session of that routine only', () => {
    const history = [
      session('volume', [[180, 12], [180, 12]], 1),
      session('heavy', [[220, 5], [220, 5]], 2),
      session('heavy', [[215, 5], [215, 5]], 9),
      session(undefined, [[315, 1]], 0),
    ];
    expect(getRoutineAnchor('heavy', BENCH, history)).toMatchObject({ weight: 220, reps: 5 });
    expect(getRoutineAnchor('volume', BENCH, history)).toMatchObject({ weight: 180, reps: 12 });
    expect(getRoutineAnchor('new-day', BENCH, history)).toBeNull();
  });
});

describe('seeding a slot with no history of its own', () => {
  it('rep-translates the current working set when ranges are far apart', () => {
    const volume = day('volume', 'Volume 3×12', 12);
    const calc = calculateRoutine(volume, { [BENCH]: record(225, 5) }, 'lbs', []);
    const ex = calc.exercises[0];

    // Equivalent of 225×5 at 12 reps via the same curve, grid-floored minus one
    // increment (bench increment = 5).
    const equivalent = OneRMCalculator.estimate(225, 5) * (OneRMCalculator.getPercentageFor(12) / 100);
    const expected = Math.max(5, Math.floor(equivalent / 5) * 5 - 5);
    expect(ex.workingWeight).toBe(expected);
    expect(ex.workingWeight).toBeLessThan(200); // far below the 5-rep load
    expect(ex.workingWeight).toBeGreaterThan(150); // but a real working weight
    expect(ex.sets.find(s => !s.isWarmup)?.reps).toBe(12); // prescribes the slot's floor
    expect(ex.progression).toBe('maintain'); // a seed to validate, not a move
  });

  it('uses the record directly when its reps are within the slot range', () => {
    const push = day('push', 'Push 3×8', 8);
    const t = target(calculateRoutine(push, { [BENCH]: record(155, 8) }, 'lbs', []));
    expect(t).toEqual({ weight: 155, reps: 9 }); // in range → add-rep, as before
  });

  it('cold-starts blank with no record at all', () => {
    const push = day('push', 'Push 3×8', 8);
    expect(target(calculateRoutine(push, {}, 'lbs', [])).weight).toBe(0);
  });
});

describe('cross-day spiral regression', () => {
  it('alternating heavy and volume days never erodes either target', () => {
    const heavy = day('heavy', 'Heavy 3×5', 5);
    const volume = day('volume', 'Volume 3×12', 12);
    // Established heavy bencher; volume day brand new.
    const history: GeneratedWorkout[] = [session('heavy', [[225, 5], [225, 5], [225, 5]], 10)];
    let records: Record<string, ExerciseRecord> = { [BENCH]: record(225, 5) };

    const heavyTargets: number[] = [];
    const volumeTargets: number[] = [];
    const days = [volume, heavy, volume, heavy, volume, heavy, volume, heavy];
    days.forEach((d, i) => {
      const calc = calculateRoutine(d, records, 'lbs', history);
      const t = target(calc);
      (d.id === 'heavy' ? heavyTargets : volumeTargets).push(t.weight);
      // Obedient user: performs the prescription exactly, all sets done.
      const performed: [number, number][] = [[t.weight, t.reps], [t.weight, t.reps], [t.weight, t.reps]];
      history.push(session(d.id, performed, -(i + 1)));
      records = updateExerciseRecords(records, [
        { id: BENCH, completedSets: performed.map(([weight, reps]) => ({ weight, reps, unit: 'lbs' as const, completed: true })) },
      ], new Date(Date.UTC(2026, 6, i + 1)));
    });

    // The old shared-anchor rule collapsed 225 → 95 over these 8 sessions.
    for (const w of heavyTargets) expect(w).toBeGreaterThanOrEqual(225);
    for (let i = 1; i < heavyTargets.length; i++) expect(heavyTargets[i]).toBeGreaterThanOrEqual(heavyTargets[i - 1]);
    for (let i = 1; i < volumeTargets.length; i++) expect(volumeTargets[i]).toBeGreaterThanOrEqual(volumeTargets[i - 1]);
  });
});

describe('finish-time routine folding (ratchet regression)', () => {
  const stored = day('heavy', 'Heavy 3×5', 5).exercises;

  // The draft as loaded from the calculated routine: prescription reps, un-done.
  const draftFrom = (reps: number) => {
    const parsed: ParsedWorkout = {
      exercises: [{
        name: 'Bench Press (Barbell)',
        matchedExerciseId: BENCH,
        isCustom: false,
        sets: [
          { weight: 225, reps, unit: 'lbs', completed: false },
          { weight: 225, reps, unit: 'lbs', completed: false },
          { weight: 225, reps, unit: 'lbs', completed: false },
        ],
      }],
      confidence: 1,
      rawText: '',
    };
    return buildDraft(parsed, { asTarget: true });
  };

  it('an unchanged session no longer reports "routine changed"', () => {
    // Prescription said 6 (add-rep) while the stored floor is 5 — reps are
    // performance, not structure, so no prompt.
    expect(routineDiffersFromDraft(draftFrom(6), stored)).toBe(false);
  });

  it('a structural change still prompts', () => {
    const d = draftFrom(6);
    const shorter = removeSet(d, d[0].key, 2);
    // Different set count on the same exercise → structure changed.
    expect(routineDiffersFromDraft(shorter, stored)).toBe(true);
  });

  it('folding keeps the stored rep floors on carried-over sets', () => {
    const folded = draftToRoutineExercises(draftFrom(6), stored);
    expect(folded[0].sets.map(s => s.reps)).toEqual([5, 5, 5]); // floor survives
  });

  it('added sets inherit the floor; a new exercise takes its reps from the draft', () => {
    const parsed: ParsedWorkout = {
      exercises: [
        {
          name: 'Bench Press (Barbell)', matchedExerciseId: BENCH, isCustom: false,
          sets: [6, 6, 6, 6].map(reps => ({ weight: 225, reps, unit: 'lbs' as const, completed: false })),
        },
        {
          name: 'Squat (Barbell)', matchedExerciseId: 'squat-barbell', isCustom: false,
          sets: [{ weight: 185, reps: 10, unit: 'lbs' as const, completed: false }],
        },
      ],
      confidence: 1,
      rawText: '',
    };
    const folded = draftToRoutineExercises(buildDraft(parsed, { asTarget: true }), stored);
    expect(folded[0].sets.map(s => s.reps)).toEqual([5, 5, 5, 5]); // 4th set inherits the floor
    expect(folded[1]).toMatchObject({ exerciseId: 'squat-barbell', sets: [{ reps: 10 }] });
  });
});
