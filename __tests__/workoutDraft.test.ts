import {
  mergeParsed,
  draftFromParsed,
  draftToNoteText,
  updateSet,
  addSet,
  removeSet,
  removeExercise,
  addNamedExercise,
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

describe('smart prefill', () => {
  const prev = [{ weight: 135, reps: 8, unit: 'lbs' as const }, { weight: 155, reps: 6, unit: 'lbs' as const }];

  it('addNamedExercise pre-fills sets from the reference values', () => {
    const d = addNamedExercise([], { name: 'Bench Press', exerciseId: 'bench-press-barbell', recognized: true, previous: prev });
    expect(d[0].sets).toEqual(prev.map(s => ({ ...s, done: false })));
  });

  it('addNamedExercise with no reference starts with no sets', () => {
    const d = addNamedExercise([], { name: 'Cable Fly', exerciseId: 'cable-fly', recognized: true });
    expect(d[0].sets).toHaveLength(0);
  });

  it('buildDraft(asTarget) pre-fills working sets from the prescription un-done', () => {
    const parsed = { exercises: [ex('Bench', [[185, 5], [185, 5]], 'bench-press-barbell')], confidence: 1, rawText: '' };
    const d = buildDraft(parsed, { asTarget: true });
    expect(d[0].sets).toHaveLength(2);
    expect(d[0].sets.every(s => s.done === false)).toBe(true);
  });
});

describe('draftToParsedWorkout', () => {
  it('drops sets left explicitly un-done, keeping only performed ones', () => {
    // Routine/target sets start done:false; only the ones checked off should log.
    let d = buildDraft({ exercises: [ex('Bench', [[135, 8], [135, 8]])], confidence: 1, rawText: '' }, { asTarget: true });
    d = toggleSetDone(d, d[0].key, 0); // check off only the first set
    const parsed = draftToParsedWorkout(d);
    expect(parsed.exercises[0].sets).toHaveLength(1);
    expect(parsed.exercises[0].sets[0].completed).toBe(true);
  });

  it('keeps composer/voice sets (checked off with done:true)', () => {
    // The composer/voice path merges sets already checked off (done:true); they log.
    const d = mergeParsed([], [ex('Bench', [[135, 8], [135, 8]])], { done: true });
    const parsed = draftToParsedWorkout(d);
    expect(parsed.exercises[0].sets).toHaveLength(2);
    expect(parsed.exercises[0].sets.every(s => s.completed)).toBe(true);
  });

  it('drops sets that were never checked off (done undefined)', () => {
    // Prefill/restore sets arrive un-checked (done undefined) and must NOT log as
    // completed — they render un-done, so saving them would be the "phantom set" bug.
    const d = draftFromParsed({ exercises: [ex('Bench', [[135, 8], [135, 8]])], confidence: 1, rawText: '' });
    expect(draftToParsedWorkout(d).exercises).toHaveLength(0);
  });

  it('drops an exercise with no performed sets entirely', () => {
    const d = buildDraft({ exercises: [ex('Bench', [[135, 8]])], confidence: 1, rawText: '' }, { asTarget: true });
    // never checked off → nothing performed
    expect(draftToParsedWorkout(d).exercises).toHaveLength(0);
  });
});

describe('totalVolume', () => {
  it('sums weight × reps across the draft', () => {
    const d = draftFromParsed({ exercises: [ex('Bench', [[100, 10], [100, 5]])], confidence: 1, rawText: '' });
    expect(totalVolume(d)).toBe(1500);
  });
});
