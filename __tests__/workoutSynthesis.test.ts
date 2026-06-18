import { synthesize, parseEntryLocal, _clearEntryCache } from '../lib/workout/workoutSynthesis';
import { workoutNoteParser } from '../lib/workout/workoutNoteParser';
import { getAvailableWorkouts } from '../lib/workout/workouts';

beforeEach(() => _clearEntryCache());

describe('synthesize', () => {
  it('folds multiple lines into consolidated exercises', () => {
    const out = synthesize('Bench 135x8, 155x6\nSquat 225x5', 'lbs');
    expect(out.exercises).toHaveLength(2);
    expect(out.totalSets).toBe(3);
    const bench = out.exercises.find(e => /bench/i.test(e.name));
    expect(bench?.sets).toHaveLength(2);
  });

  it('consolidates the same exercise logged across separate lines', () => {
    const out = synthesize('Bench 135x8\nBench 155x6', 'lbs');
    expect(out.exercises).toHaveLength(1);
    expect(out.exercises[0].sets).toHaveLength(2);
  });

  it('flags lines it cannot parse as low-confidence instead of inventing sets', () => {
    // A bare number with no exercise name yields nothing locally
    const out = synthesize('Bench 135x8\n!!!', 'lbs');
    expect(out.exercises).toHaveLength(1);
    expect(out.lowConfidenceLines).toContain('!!!');
  });

  it('marks recognized vs unmatched exercises', () => {
    // A real exercise name resolves to a known exercise (recognized); a made-up
    // one does not. We assert recognition directly rather than by display name,
    // since the matcher may canonicalize to a specific equipment variant.
    const realName = getAvailableWorkouts(100)[0].name;
    expect(synthesize(`${realName} 135x8`, 'lbs').exercises[0]?.recognized).toBe(true);
    expect(synthesize('Flumboxes 100x5', 'lbs').exercises[0]?.recognized).toBe(false);
  });
});

describe('per-entry cache', () => {
  it('parses a given line only once', () => {
    const spy = jest.spyOn(workoutNoteParser, 'parseLocal');
    parseEntryLocal('Bench 135x8', 'lbs');
    parseEntryLocal('Bench 135x8', 'lbs');
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('re-folding the sheet does not re-parse unchanged lines', () => {
    const spy = jest.spyOn(workoutNoteParser, 'parseLocal');
    synthesize('Bench 135x8\nSquat 225x5', 'lbs'); // 2 parses
    synthesize('Bench 135x8\nSquat 225x5\nRows 95x10', 'lbs'); // only the new line
    expect(spy).toHaveBeenCalledTimes(3);
    spy.mockRestore();
  });
});
