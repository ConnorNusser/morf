import {
  mergeParsed,
  draftFromParsed,
  draftToNoteText,
  updateSet,
  addSet,
  removeSet,
  removeExercise,
  addNamedExercise,
  applySuggestion,
  dismissSuggestion,
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

describe('autofill suggestions', () => {
  const suggestion = [{ weight: 135, reps: 8, unit: 'lbs' as const }, { weight: 155, reps: 6, unit: 'lbs' as const }];

  it('addNamedExercise adds a set-less exercise carrying a suggestion', () => {
    const d = addNamedExercise([], { name: 'Bench Press', exerciseId: 'bench-press-barbell', recognized: true, suggestion });
    expect(d).toHaveLength(1);
    expect(d[0].sets).toHaveLength(0);
    expect(d[0].suggestion).toEqual(suggestion);
  });

  it('addNamedExercise is a no-op when the exercise is already present', () => {
    const d1 = addNamedExercise([], { name: 'Bench Press', exerciseId: 'bench-press-barbell', recognized: true });
    const d2 = addNamedExercise(d1, { name: 'Bench Press', exerciseId: 'bench-press-barbell', recognized: true });
    expect(d2).toBe(d1);
  });

  it('applySuggestion turns the suggestion into the working sets', () => {
    let d = addNamedExercise([], { name: 'Bench', exerciseId: 'bench-press-barbell', recognized: true, suggestion });
    d = applySuggestion(d, d[0].key);
    expect(d[0].sets).toEqual(suggestion);
    expect(d[0].suggestion).toBeUndefined();
  });

  it('dismissSuggestion clears it, leaving an empty exercise', () => {
    let d = addNamedExercise([], { name: 'Bench', exerciseId: 'bench-press-barbell', recognized: true, suggestion });
    d = dismissSuggestion(d, d[0].key);
    expect(d[0].suggestion).toBeUndefined();
    expect(d[0].sets).toHaveLength(0);
  });
});

describe('totalVolume', () => {
  it('sums weight × reps across the draft', () => {
    const d = draftFromParsed({ exercises: [ex('Bench', [[100, 10], [100, 5]])], confidence: 1, rawText: '' });
    expect(totalVolume(d)).toBe(1500);
  });
});
