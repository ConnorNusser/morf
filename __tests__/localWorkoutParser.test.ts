import { parseLine, matchExerciseByName, _resetIndex } from '../lib/workout/localWorkoutParser';

beforeEach(() => _resetIndex());

const sets = (line: string) => parseLine(line, 'lbs')?.sets ?? [];

describe('parseLine — set formats', () => {
  it('weight x reps, comma separated', () => {
    expect(sets('Bench Press 135x8, 155x6')).toEqual([
      { weight: 135, reps: 8, unit: 'lbs' },
      { weight: 155, reps: 6, unit: 'lbs' },
    ]);
  });

  it('counts space-separated sets in one segment as multiple', () => {
    expect(sets('Bench 135x8 135x8')).toEqual([
      { weight: 135, reps: 8, unit: 'lbs' },
      { weight: 135, reps: 8, unit: 'lbs' },
    ]);
    expect(sets('Bench 135x8 155x6')).toHaveLength(2);
  });

  it('weight x reps x sets expands the set count', () => {
    expect(sets('Squat 225x5x3')).toEqual([
      { weight: 225, reps: 5, unit: 'lbs' },
      { weight: 225, reps: 5, unit: 'lbs' },
      { weight: 225, reps: 5, unit: 'lbs' },
    ]);
  });

  it('carries the weight forward across rep-only segments', () => {
    expect(sets('Deadlift 315x5, 5, 4')).toEqual([
      { weight: 315, reps: 5, unit: 'lbs' },
      { weight: 315, reps: 5, unit: 'lbs' },
      { weight: 315, reps: 4, unit: 'lbs' },
    ]);
  });

  it('handles "weight for reps"', () => {
    expect(sets('Squats 225 for 5')).toEqual([{ weight: 225, reps: 5, unit: 'lbs' }]);
  });

  it('handles two bare numbers', () => {
    expect(sets('Press 95 8')).toEqual([{ weight: 95, reps: 8, unit: 'lbs' }]);
  });

  it('reads bodyweight rep lists', () => {
    expect(sets('Pull-ups bodyweight x10, 8, 6')).toEqual([
      { weight: 0, reps: 10, unit: 'lbs' },
      { weight: 0, reps: 8, unit: 'lbs' },
      { weight: 0, reps: 6, unit: 'lbs' },
    ]);
  });

  it('respects a per-set unit override', () => {
    expect(sets('Squat 100kg x5')).toEqual([{ weight: 100, reps: 5, unit: 'kg' }]);
  });

  it('strips @RPE noise', () => {
    expect(sets('Bench 185x5 @8')).toEqual([{ weight: 185, reps: 5, unit: 'lbs' }]);
  });

  it('ignores a line with no parseable sets', () => {
    expect(parseLine('felt strong today', 'lbs')).toBeNull();
    expect(parseLine('!!!', 'lbs')).toBeNull();
  });
});

describe('parseLine — names', () => {
  it('keeps hyphens and apostrophes in the name', () => {
    expect(parseLine('Push-up x10', 'lbs')?.name).toBe('Push-up');
    expect(parseLine("Farmer's Walk 100x1", 'lbs')?.name).toBe("Farmer's Walk");
  });
});

describe('matchExerciseByName', () => {
  it('resolves a plain name without an equipment qualifier', () => {
    expect(matchExerciseByName('bench press')).toBeTruthy();
  });
  it('tolerates pluralization (pull-ups -> pull up)', () => {
    expect(matchExerciseByName('pull-ups')).toBeTruthy();
  });
  it('returns null for an unknown movement', () => {
    expect(matchExerciseByName('flumbox press')).toBeNull();
  });
  it('expands common shorthand (bp -> bench press)', () => {
    expect(matchExerciseByName('bp')).toBe(matchExerciseByName('bench press'));
    expect(matchExerciseByName('rdl')).toBe(matchExerciseByName('romanian deadlift'));
  });

  it('honors an equipment qualifier instead of defaulting to barbell', () => {
    // The reported bug: "overhead press machine" collapsed to the barbell press.
    expect(matchExerciseByName('overhead press machine')).toBe('overhead-press-machine');
    expect(matchExerciseByName('overhead press')).toBe('overhead-press-barbell');
    expect(matchExerciseByName('overhead press machine')).not.toBe(matchExerciseByName('overhead press'));
  });

  it('matches a leading equipment qualifier too', () => {
    expect(matchExerciseByName('machine overhead press')).toBe('overhead-press-machine');
  });

  it('expands shorthand combined with an equipment qualifier (ohp machine)', () => {
    expect(matchExerciseByName('ohp machine')).toBe('overhead-press-machine');
  });

  it('still resolves a name that legitimately contains an equipment word', () => {
    // "cable" is part of the actual catalog name, not a disambiguating qualifier.
    expect(matchExerciseByName('cable crossover')).toBe(matchExerciseByName('cable crossover'));
    expect(matchExerciseByName('cable crossover')).toBeTruthy();
  });
});
