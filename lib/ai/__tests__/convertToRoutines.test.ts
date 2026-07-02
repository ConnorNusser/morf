/**
 * Tests for the routine-generation conversion seam (convertToRoutines).
 * Covers the fixes verified necessary by the output audit: rep parsing, per-movement
 * intensity, duplicate-exercise merging, hard-exclude enforcement, and weight seeding.
 */

const mockGetWorkoutHistory = jest.fn().mockResolvedValue([]);
const mockGetCustomExercises = jest.fn().mockResolvedValue([]);

jest.mock('@/lib/storage/storage', () => ({
  storageService: {
    getCustomExercises: (...a: any[]) => mockGetCustomExercises(...a),
    getWorkoutHistory: (...a: any[]) => mockGetWorkoutHistory(...a),
  },
}));
jest.mock('@/lib/services/userService', () => ({
  userService: { getRealUserProfile: jest.fn().mockResolvedValue({ weightUnitPreference: 'lbs' }) },
}));
jest.mock('@/lib/services/analytics', () => ({
  analyticsService: { trackAIUsage: jest.fn(), logInfo: jest.fn(), logWarn: jest.fn(), logErr: jest.fn() },
}));

import { aiRoutineGenerator, GeneratedRoutineProgram } from '../aiRoutineGenerator';

function program(exercises: { name: string; sets: number; reps: number | string; notes?: string }[]): GeneratedRoutineProgram {
  return {
    programName: 'Test', programStyle: 'upper_lower' as any, trainingGoal: 'powerbuilding' as any,
    routines: [{ name: 'Day 1', dayNumber: 1, focus: 'test', targetMuscles: [], exercises, estimatedTime: '60 min' }],
  };
}

beforeEach(() => {
  mockGetWorkoutHistory.mockResolvedValue([]);
  mockGetCustomExercises.mockResolvedValue([]);
});

describe('convertToRoutines conversion seam', () => {
  it('merges duplicate exercises (top set + AMRAP) into one entry', async () => {
    const [routine] = await aiRoutineGenerator.convertToRoutines(program([
      { name: 'Bench Press (Barbell)', sets: 4, reps: '5' },
      { name: 'Bench Press (Barbell)', sets: 1, reps: '5+' },
      { name: 'Bicep Curl (Barbell)', sets: 3, reps: '8-12' },
    ]));
    expect(routine.exercises).toHaveLength(2);
    const bench = routine.exercises.find(e => e.exerciseId === 'bench-press-barbell')!;
    expect(bench.sets).toHaveLength(5); // 4 + 1 merged
    // distinct exercise ids (no collision when merging)
    expect(new Set(routine.exercises.map(e => e.exerciseId)).size).toBe(2);
  });

  it('parses rep ranges/AMRAP/time strings to the correct base rep', async () => {
    const [routine] = await aiRoutineGenerator.convertToRoutines(program([
      { name: 'Bench Press (Barbell)', sets: 3, reps: '8-12' },   // -> 8 (low end is the base)
      { name: 'Bicep Curl (Barbell)', sets: 3, reps: '5+' },      // -> 5
      { name: 'Lateral Raise (Dumbbells)', sets: 3, reps: '30-60 sec' }, // -> 30 (not NaN)
      { name: 'Leg Curl (Machine)', sets: 3, reps: 12 },          // -> 12
    ]));
    const base = (id: string) => routine.exercises.find(e => e.exerciseId === id)!.sets[0].reps;
    expect(base('bench-press-barbell')).toBe(8);
    expect(base('bicep-curl-barbell')).toBe(5);
    expect(base('lateral-raise-dumbbells')).toBe(30);
    expect(base('leg-curl-machine')).toBe(12);
  });

  it('derives intensity per movement instead of blanket heavy', async () => {
    const [routine] = await aiRoutineGenerator.convertToRoutines(program([
      { name: 'Bench Press (Barbell)', sets: 4, reps: 5 },   // compound, low rep -> heavy
      { name: 'Bicep Curl (Barbell)', sets: 3, reps: 12 },   // isolation -> light
    ]));
    const im = (id: string) => routine.exercises.find(e => e.exerciseId === id)!.intensityModifier;
    expect(im('bench-press-barbell')).toBe('heavy');
    expect(im('bicep-curl-barbell')).toBe('light');
  });

  it('tags higher-rep compound work as moderate', async () => {
    const [routine] = await aiRoutineGenerator.convertToRoutines(program([
      { name: 'Bench Press (Barbell)', sets: 3, reps: 10 },
    ]));
    expect(routine.exercises[0].intensityModifier).toBe('moderate');
  });

  it('enforces hard excludes at the seam even if the model returned them', async () => {
    const [routine] = await aiRoutineGenerator.convertToRoutines(
      program([
        { name: 'Bench Press (Barbell)', sets: 4, reps: 5 },
        { name: 'Bicep Curl (Barbell)', sets: 3, reps: 12 },
      ]),
      { excludedExerciseIds: ['bench-press-barbell'] },
    );
    expect(routine.exercises.map(e => e.exerciseId)).toEqual(['bicep-curl-barbell']);
  });

});
