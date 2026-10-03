import { calculatePPLBreakdown } from '@/lib/data/pplCategories';
import { groupExercisesByPPL } from '@/lib/data/pplExerciseGroups';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';

const nameOf = (id: string): string => getCatalogExercise(id)!.name;

describe('groupExercisesByPPL', () => {
  it('returns empty buckets for no exercises', () => {
    expect(groupExercisesByPPL([])).toEqual({ push: [], pull: [], legs: [] });
  });

  it('buckets catalog exercises by primary muscle, keeping order and sets', () => {
    const result = groupExercisesByPPL([
      { name: nameOf('bench-press-barbell'), sets: 4 },
      { name: nameOf('squat-barbell'), sets: 5 },
      { name: nameOf('lat-pulldown-cables'), sets: 3 },
      { name: nameOf('bicep-curl-barbell'), sets: 2 },
    ]);

    expect(result.push).toEqual([{ name: nameOf('bench-press-barbell'), sets: 4 }]);
    expect(result.legs).toEqual([{ name: nameOf('squat-barbell'), sets: 5 }]);
    expect(result.pull).toEqual([
      { name: nameOf('lat-pulldown-cables'), sets: 3 },
      { name: nameOf('bicep-curl-barbell'), sets: 2 },
    ]);
  });

  it('matches catalog names case-insensitively and keeps the given casing', () => {
    const upper = nameOf('squat-barbell').toUpperCase();
    expect(groupExercisesByPPL([{ name: upper, sets: 1 }]).legs).toEqual([
      { name: upper, sets: 1 },
    ]);
  });

  it('drops exercises that are not in the catalog', () => {
    expect(groupExercisesByPPL([{ name: 'Not A Real Lift 123', sets: 3 }])).toEqual({
      push: [],
      pull: [],
      legs: [],
    });
  });

  it('puts triceps arms exercises in push, like the chip counts', () => {
    const name = nameOf('tricep-pushdown-cables');
    const result = groupExercisesByPPL([{ name, sets: 3 }]);
    expect(result.push).toEqual([{ name, sets: 3 }]);
    expect(result.pull).toEqual([]);
  });

  it('lists exactly as many exercises per category as calculatePPLBreakdown counts', () => {
    const exercises = [
      'bench-press-barbell',
      'tricep-pushdown-cables',
      'skull-crushers-dumbbells',
      'bicep-curl-barbell',
      'lat-pulldown-cables',
      'squat-barbell',
    ].map(id => ({ name: nameOf(id), sets: 3 }));
    exercises.push({ name: 'Not A Real Lift 123', sets: 3 });

    const groups = groupExercisesByPPL(exercises);
    const { counts } = calculatePPLBreakdown(exercises);
    expect(groups.push).toHaveLength(counts.push);
    expect(groups.pull).toHaveLength(counts.pull);
    expect(groups.legs).toHaveLength(counts.legs);
  });
});
