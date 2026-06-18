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
    // Use a real exercise whose name has no hyphen/digit — the local regex name
    // pattern is [a-zA-Z\s()]+, so it truncates names like "Push-up (Bodyweight)"
    // (a known limitation that AI escalation exists to cover).
    const realName = getAvailableWorkouts(100).find(e => /^[a-zA-Z ()]+$/.test(e.name))!.name;
    const out = synthesize(`${realName} 135x8\nFlumboxes 100x5`, 'lbs');
    const real = out.exercises.find(e => e.name === realName);
    const made = out.exercises.find(e => /flumbox/i.test(e.name));
    expect(real?.recognized).toBe(true);
    expect(made?.recognized).toBe(false);
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
