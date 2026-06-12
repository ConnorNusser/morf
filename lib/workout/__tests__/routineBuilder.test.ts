import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import { buildProgram, GOAL_PROGRAMMING } from '../routineBuilder';

const baseReps = (r: { sets: { reps: number }[] }) => r.sets[0].reps;

describe('buildProgram', () => {
  it('builds one routine per training day, clamped to 3–6', () => {
    expect(buildProgram('hypertrophy', 6)).toHaveLength(6);
    expect(buildProgram('hypertrophy', 4)).toHaveLength(4);
    expect(buildProgram('hypertrophy', 2)).toHaveLength(3); // clamp up
    expect(buildProgram('hypertrophy', 9)).toHaveLength(6); // clamp down
  });

  it('makes the GOAL actually drive reps — hypertrophy trains heavier-rep than strength', () => {
    const hyp = buildProgram('hypertrophy', 6).flatMap(d => d.exercises);
    const str = buildProgram('strength', 6).flatMap(d => d.exercises);
    const hypCompound = baseReps(hyp.find(e => e.intensityModifier !== 'light')!);
    const strCompound = baseReps(str.find(e => e.intensityModifier !== 'light')!);
    expect(hypCompound).toBe(GOAL_PROGRAMMING.hypertrophy.compoundReps); // 9
    expect(strCompound).toBe(GOAL_PROGRAMMING.strength.compoundReps); // 4
    expect(hypCompound).toBeGreaterThan(strCompound); // the bug this fixes
  });

  it('applies the goal table: compound vs accessory sets/reps/intensity', () => {
    const legs = buildProgram('hypertrophy', 6).find(d => d.splitType === 'legs')!;
    const squat = legs.exercises.find(e => e.exerciseId === 'squat-barbell')!;
    const calf = legs.exercises.find(e => e.exerciseId === 'calf-raise-machine')!;
    expect(squat.sets).toHaveLength(GOAL_PROGRAMMING.hypertrophy.compoundSets);
    expect(baseReps(squat)).toBe(GOAL_PROGRAMMING.hypertrophy.compoundReps);
    expect(squat.intensityModifier).toBe('moderate');
    expect(calf.sets).toHaveLength(GOAL_PROGRAMMING.hypertrophy.accessorySets);
    expect(baseReps(calf)).toBe(GOAL_PROGRAMMING.hypertrophy.accessoryReps);
    expect(calf.intensityModifier).toBe('light');
  });

  it('only uses real exercises from the database', () => {
    const ids = new Set(ALL_WORKOUTS.map(w => w.id));
    for (const goal of ['strength', 'hypertrophy', 'general'] as const) {
      for (const days of [3, 4, 5, 6]) {
        for (const routine of buildProgram(goal, days)) {
          for (const ex of routine.exercises) expect(ids.has(ex.exerciseId)).toBe(true);
        }
      }
    }
  });

  it('seeds weight 0 with no history (progressive overload fills it later)', () => {
    const r = buildProgram('hypertrophy', 3, { history: [] });
    for (const routine of r) {
      for (const ex of routine.exercises) {
        expect(routine.progressionState![ex.exerciseId].currentWeight).toBe(0);
      }
    }
  });
});
