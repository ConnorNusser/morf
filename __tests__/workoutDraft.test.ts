import {
  mergeParsed,
  draftFromParsed,
  draftToNoteText,
  updateSet,
  addSet,
  removeSet,
  removeExercise,
  addNamedExercise,
  applyReference,
  attachPrevious,
  buildDraft,
  draftToParsedWorkout,
  toggleSetDone,
  totalVolume,
  WorkoutDraft,
} from '../lib/workout/workoutDraft';
import { ParsedExercise } from '../lib/workout/workoutNoteParser';

const ex = (name: string, sets: [number, number][], matchedExerciseId?: string): ParsedExercise => ({
  name,
  matchedExerciseId,
  isCustom: !matchedExerciseId,
  sets: sets.map(([weight, reps]) => ({ weight, reps, unit: 'lbs' as const })),
});

describe('mergeParsed', () => {
  it('adds new exercises with stable unique keys', () => {
    const d = mergeParsed([], [ex('Bench', [[135, 8]]), ex('Squat', [[225, 5]])]);
    expect(d).toHaveLength(2);
    expect(d[0].key).not.toBe(d[1].key);
  });

  it('appends sets to an existing exercise (same id)', () => {
    let d: WorkoutDraft = mergeParsed([], [ex('Bench', [[135, 8]], 'bench-press-barbell')]);
    d = mergeParsed(d, [ex('Bench Press', [[155, 6]], 'bench-press-barbell')]);
    expect(d).toHaveLength(1);
    expect(d[0].sets).toHaveLength(2);
  });

  it('does not mutate the input draft', () => {
    const d1 = mergeParsed([], [ex('Bench', [[135, 8]])]);
    const d2 = mergeParsed(d1, [ex('Bench', [[155, 6]])]);
    expect(d1[0].sets).toHaveLength(1);
    expect(d2[0].sets).toHaveLength(2);
  });
});

describe('draftToNoteText', () => {
  it('round-trips weighted and bodyweight sets', () => {
    const d = draftFromParsed({ exercises: [ex('Bench', [[135, 8], [155, 6]]), ex('Pull-up', [[0, 10]])], confidence: 1, rawText: '' });
    const text = draftToNoteText(d);
    expect(text).toContain('Bench 135x8, 155x6');
    expect(text).toContain('Pull-up x10');
  });

  it('encodes kg so the unit survives serialization', () => {
    const d: WorkoutDraft = [{ key: 'k', name: 'Squat', recognized: false, sets: [{ weight: 100, reps: 5, unit: 'kg' }] }];
    expect(draftToNoteText(d)).toBe('Squat 100kgx5');
  });
});

describe('edit helpers', () => {
  const base = (): WorkoutDraft => draftFromParsed({ exercises: [ex('Bench', [[135, 8], [135, 8]])], confidence: 1, rawText: '' });

  it('updateSet patches a single set immutably', () => {
    const d = base();
    const next = updateSet(d, d[0].key, 1, { reps: 6, weight: 145 });
    expect(next[0].sets[1]).toMatchObject({ weight: 145, reps: 6 });
    expect(d[0].sets[1]).toMatchObject({ weight: 135, reps: 8 }); // original untouched
  });

  it('toggleSetDone flips the done flag on one set', () => {
    const d = base();
    const next = toggleSetDone(d, d[0].key, 0);
    expect(next[0].sets[0].done).toBe(true);
    expect(next[0].sets[1].done).toBeFalsy();
    expect(toggleSetDone(next, d[0].key, 0)[0].sets[0].done).toBe(false);
  });

  it('addSet duplicates the last set', () => {
    const d = base();
    const next = addSet(d, d[0].key);
    expect(next[0].sets).toHaveLength(3);
    expect(next[0].sets[2]).toMatchObject({ weight: 135, reps: 8 });
  });

  it('removeSet drops the exercise when its last set goes', () => {
    let d: WorkoutDraft = draftFromParsed({ exercises: [ex('Bench', [[135, 8]])], confidence: 1, rawText: '' });
    d = removeSet(d, d[0].key, 0);
    expect(d).toHaveLength(0);
  });

  it('removeExercise drops the whole card', () => {
    const d = base();
    expect(removeExercise(d, d[0].key)).toHaveLength(0);
  });
});

describe('references + autofill', () => {
  const prev = [{ weight: 135, reps: 8, unit: 'lbs' as const }, { weight: 155, reps: 6, unit: 'lbs' as const }];
  const target = [{ weight: 185, reps: 5, unit: 'lbs' as const }];

  it('addNamedExercise autofills sets from the reference and keeps it as a ghost', () => {
    const d = addNamedExercise([], { name: 'Bench Press', exerciseId: 'bench-press-barbell', recognized: true, previous: prev });
    expect(d[0].sets).toEqual(prev.map(s => ({ ...s, done: false })));
    expect(d[0].previous).toEqual(prev);
  });

  it('addNamedExercise with no reference starts with no sets', () => {
    const d = addNamedExercise([], { name: 'Cable Fly', exerciseId: 'cable-fly', recognized: true });
    expect(d[0].sets).toHaveLength(0);
  });

  it('applyReference fills sets from previous or target and keeps the reference', () => {
    let d = addNamedExercise([], { name: 'Bench', exerciseId: 'bench-press-barbell', recognized: true, previous: prev, target });
    const fromTarget = applyReference(d, d[0].key, 'target');
    expect(fromTarget[0].sets).toEqual(target.map(s => ({ ...s, done: false })));
    expect(fromTarget[0].target).toEqual(target); // reference persists for the ghost

    const fromPrev = applyReference(d, d[0].key, 'previous');
    expect(fromPrev[0].sets).toEqual(prev.map(s => ({ ...s, done: false })));
  });

  it('buildDraft(asTarget) autofills working sets from the prescription and keeps it as target', () => {
    const parsed = { exercises: [ex('Bench', [[185, 5], [185, 5]], 'bench-press-barbell')], confidence: 1, rawText: '' };
    const d = buildDraft(parsed, { asTarget: true });
    expect(d[0].sets).toHaveLength(2);
    expect(d[0].sets.every(s => s.done === false)).toBe(true);
    expect(d[0].target).toHaveLength(2);
  });

  it('attachPrevious fills in references only where missing', () => {
    const d = mergeParsed([], [ex('Bench', [[135, 8]], 'bench-press-barbell')]);
    const out = attachPrevious(d, () => prev);
    expect(out[0].previous).toEqual(prev);
  });
});

describe('draftToParsedWorkout', () => {
  it('carries each set\'s done state into completed', () => {
    let d = draftFromParsed({ exercises: [ex('Bench', [[135, 8], [135, 8]])], confidence: 1, rawText: '' });
    d = toggleSetDone(d, d[0].key, 0); // mark only the first set done
    const parsed = draftToParsedWorkout(d);
    expect(parsed.exercises[0].sets[0].completed).toBe(true);
    expect(parsed.exercises[0].sets[1].completed).toBe(false);
  });

  it('carries the routine prescription into targetSets so progression can grade it', () => {
    // Start a routine (target 3×190×8), autofill, then log lighter actuals.
    const parsed = { exercises: [ex('Bench', [[190, 8], [190, 8], [190, 8]], 'bench-press-barbell')], confidence: 1, rawText: '' };
    let d = buildDraft(parsed, { asTarget: true });
    d = applyReference(d, d[0].key, 'target');
    d = updateSet(d, d[0].key, 1, { weight: 165, reps: 5 });
    const out = draftToParsedWorkout(d);
    expect(out.exercises[0].targetSets).toEqual([
      { weight: 190, reps: 8, unit: 'lbs' },
      { weight: 190, reps: 8, unit: 'lbs' },
      { weight: 190, reps: 8, unit: 'lbs' },
    ]);
  });

  it('omits targetSets for a freestyle workout (no prescription)', () => {
    const d = draftFromParsed({ exercises: [ex('Bench', [[135, 8]])], confidence: 1, rawText: '' });
    expect(draftToParsedWorkout(d).exercises[0].targetSets).toBeUndefined();
  });
});

describe('totalVolume', () => {
  it('sums weight × reps across the draft', () => {
    const d = draftFromParsed({ exercises: [ex('Bench', [[100, 10], [100, 5]])], confidence: 1, rawText: '' });
    expect(totalVolume(d)).toBe(1500);
  });
});
