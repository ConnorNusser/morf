import {
  EQUIPMENT_OPTIONS,
  extractBaseName,
  filterCustomExercises,
  generateExerciseId,
  generateFullExerciseName,
  getCustomExercisesSummary,
} from '@/lib/workout/customExercises';
import { ALL_EQUIPMENT } from '@/lib/workout/equipment';
import { CustomExercise } from '@/types';

const exerciseOf = (partial: Partial<CustomExercise>): CustomExercise =>
  ({ id: 'x', name: 'X', ...partial } as unknown as CustomExercise);

describe('EQUIPMENT_OPTIONS', () => {
  it('has one labelled option per equipment type, in catalog order', () => {
    expect(EQUIPMENT_OPTIONS.map(o => o.value)).toEqual(ALL_EQUIPMENT);
    expect(EQUIPMENT_OPTIONS.find(o => o.value === 'smith-machine')?.label).toBe('Smith Machine');
  });
});

describe('generateFullExerciseName', () => {
  it('title-cases the base name and appends the equipment label', () => {
    expect(generateFullExerciseName('super horizontal press', 'machine')).toBe('Super Horizontal Press (Machine)');
    expect(generateFullExerciseName('  HIP thrust ', 'smith-machine')).toBe('Hip Thrust (Smith Machine)');
  });

  it('keeps interior double spaces as typed', () => {
    expect(generateFullExerciseName('leg  press', 'cable')).toBe('Leg  Press (Cable)');
  });
});

describe('generateExerciseId', () => {
  it('kebab-cases the full name and drops parentheses', () => {
    expect(generateExerciseId('Super Horizontal Press (Machine)')).toBe('super-horizontal-press-machine');
    expect(generateExerciseId('Hip Thrust (Smith Machine)')).toBe('hip-thrust-smith-machine');
  });

  it('strips punctuation, collapses separators, and trims edge dashes', () => {
    expect(generateExerciseId("Bob's 21's! (Cable)")).toBe('bobs-21s-cable');
    expect(generateExerciseId('Leg  Press - Wide (Machine)')).toBe('leg-press-wide-machine');
    expect(generateExerciseId('-Press-')).toBe('press');
  });
});

describe('extractBaseName', () => {
  it('removes a trailing equipment suffix', () => {
    expect(extractBaseName('Super Horizontal Press (Machine)')).toBe('Super Horizontal Press');
    expect(extractBaseName('Hip Thrust (Smith Machine) ')).toBe('Hip Thrust');
  });

  it('leaves names without a trailing suffix alone', () => {
    expect(extractBaseName('Plain Name')).toBe('Plain Name');
    expect(extractBaseName('Press (Wide) Variation')).toBe('Press (Wide) Variation');
  });
});

describe('getCustomExercisesSummary', () => {
  it('pluralises by count', () => {
    expect(getCustomExercisesSummary(0)).toBe('No custom exercises yet');
    expect(getCustomExercisesSummary(1)).toBe('1 custom exercise');
    expect(getCustomExercisesSummary(3)).toBe('3 custom exercises');
  });
});

describe('filterCustomExercises', () => {
  const press = exerciseOf({
    id: 'super-press-machine', name: 'Super Press (Machine)',
    equipment: ['machine'], primaryMuscles: ['chest'], category: 'compound',
  });
  const curl = exerciseOf({
    id: 'odd-curl-cable', name: 'Odd Curl (Cable)',
    equipment: ['cable'], primaryMuscles: ['arms'], category: 'compound',
  });
  const bare = exerciseOf({ id: 'bare', name: 'Bare' });
  const all = [press, curl, bare];

  it('returns the same array when nothing is filtered', () => {
    expect(filterCustomExercises(all, '', 'all')).toBe(all);
    expect(filterCustomExercises(all, '   ', 'all')).toBe(all);
  });

  it('filters by equipment, excluding exercises with no equipment', () => {
    expect(filterCustomExercises(all, '', 'cable')).toEqual([curl]);
  });

  it('matches the query case-insensitively against name, id, muscles, equipment, and category', () => {
    expect(filterCustomExercises(all, 'SUPER', 'all')).toEqual([press]);
    expect(filterCustomExercises(all, 'odd-curl', 'all')).toEqual([curl]);
    expect(filterCustomExercises(all, 'chest', 'all')).toEqual([press]);
    expect(filterCustomExercises(all, 'cabl', 'all')).toEqual([curl]);
    expect(filterCustomExercises(all, 'compound', 'all')).toEqual([press, curl]);
  });

  it('does not trim the query before matching', () => {
    expect(filterCustomExercises(all, 'super ', 'all')).toEqual([press]);
    expect(filterCustomExercises(all, ' super', 'all')).toEqual([]);
  });

  it('combines the equipment filter and the query', () => {
    expect(filterCustomExercises(all, 'compound', 'machine')).toEqual([press]);
  });
});
