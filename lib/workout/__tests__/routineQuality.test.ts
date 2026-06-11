import { Routine } from '@/types';
import { summarizeQuality, validateRoutineQuality } from '../routineQuality';

// Build a training day from [{ id, sets, reps }] using real exercise-DB ids.
function day(name: string, exercises: { id: string; sets?: number; reps?: number }[]): Routine {
  return {
    id: name,
    name,
    exercises: exercises.map(e => ({
      exerciseId: e.id,
      sets: Array.from({ length: e.sets ?? 3 }, () => ({ reps: e.reps ?? 10 })),
    })),
    createdAt: new Date(0),
  } as Routine;
}

const pushDay = day('Push', [
  { id: 'overhead-press-barbell', sets: 4, reps: 6 },
  { id: 'dip-bodyweight', sets: 3, reps: 10 },
  { id: 'lateral-raise-dumbbells', sets: 3, reps: 12 },
  { id: 'flyes-dumbbells', sets: 3, reps: 12 },
]);
const pullDay = day('Pull', [
  { id: 'pull-up-bodyweight', sets: 4, reps: 8 },
  { id: 'deadlift-barbell', sets: 3, reps: 5 },
  { id: 'bicep-curl-barbell', sets: 3, reps: 12 },
]);
const legDay = day('Legs', [
  { id: 'squat-barbell', sets: 4, reps: 6 },
  { id: 'romanian-deadlift-barbell', sets: 3, reps: 8 },
  { id: 'leg-extension-machine', sets: 3, reps: 12 },
  { id: 'leg-curl-machine', sets: 3, reps: 12 },
]);

const codes = (r: ReturnType<typeof validateRoutineQuality>) => r.issues.map(i => i.code);

describe('validateRoutineQuality', () => {
  it('passes a well-formed PPL program with a perfect score', () => {
    const r = validateRoutineQuality([pushDay, pullDay, legDay]);
    expect(r.issues).toEqual([]);
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
  });

  it('errors and fails on an empty program', () => {
    const r = validateRoutineQuality([]);
    expect(codes(r)).toContain('empty-program');
    expect(r.passed).toBe(false);
  });

  it('flags an empty day as an error', () => {
    const r = validateRoutineQuality([pushDay, day('Rest', [])]);
    expect(codes(r)).toContain('empty-day');
    expect(r.passed).toBe(false);
  });

  it('flags isolation placed before a compound', () => {
    const bad = day('Push', [
      { id: 'flyes-dumbbells' }, // isolation first
      { id: 'dip-bodyweight' }, // compound after
    ]);
    expect(codes(validateRoutineQuality([bad]))).toContain('ordering');
    // ...and does NOT flag the correctly-ordered version.
    const good = day('Push', [{ id: 'dip-bodyweight' }, { id: 'flyes-dumbbells' }]);
    expect(codes(validateRoutineQuality([good]))).not.toContain('ordering');
  });

  it('flags an all-isolation day with no compound', () => {
    const allIso = day('Arms', [{ id: 'bicep-curl-barbell' }, { id: 'flyes-dumbbells' }]);
    expect(codes(validateRoutineQuality([allIso]))).toContain('no-compound');
  });

  it('flags a major muscle group that is never trained', () => {
    // Push + Legs, but no pulling work all week → back is missing.
    const r = validateRoutineQuality([pushDay, legDay]);
    expect(r.issues.some(i => i.code === 'muscle-gap' && /Back/.test(i.message))).toBe(true);
  });

  it('flags push/pull imbalance', () => {
    const r = validateRoutineQuality([pushDay, legDay]); // push present, no pull
    expect(codes(r)).toContain('push-pull-imbalance');
  });

  it('flags absurd rep prescriptions', () => {
    const r = validateRoutineQuality([day('Push', [{ id: 'dip-bodyweight', reps: 50 }])]);
    expect(codes(r)).toContain('rep-range');
  });

  it('flags too-low session volume', () => {
    const r = validateRoutineQuality([day('Push', [{ id: 'dip-bodyweight', sets: 2 }])]);
    expect(codes(r)).toContain('low-volume');
  });

  it('clamps the score to 0 and never passes with an error', () => {
    const r = validateRoutineQuality([]);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.passed).toBe(false);
  });

  it('flags under-volume for a barely-trained major muscle', () => {
    const r = validateRoutineQuality([day('Chest', [{ id: 'bench-press-barbell', sets: 2 }])]);
    expect(codes(r)).toContain('under-volume');
  });

  it('flags over-volume past the recoverable max', () => {
    const r = validateRoutineQuality([
      day('Chest', [
        { id: 'bench-press-barbell', sets: 14 },
        { id: 'incline-bench-press-barbell', sets: 14 }, // chest ≈ 28 sets > MRV
      ]),
    ]);
    expect(codes(r)).toContain('over-volume');
  });

  it('flags low frequency + under-volume when a 3-day PPL is judged as hypertrophy', () => {
    // Each muscle is hit ~1×/week — fine generally, but sub-optimal for hypertrophy
    // (wants ≥2×/week and ≥8 sets/muscle).
    const r = validateRoutineQuality([pushDay, pullDay, legDay], { goal: 'hypertrophy' });
    expect(codes(r)).toContain('low-frequency');
    expect(codes(r)).toContain('under-volume');
    // ...yet the same program is clean under a general goal (asserted above).
  });

  it('summarizeQuality reads cleanly for pass and fail', () => {
    expect(summarizeQuality(validateRoutineQuality([pushDay, pullDay, legDay]))).toMatch(/clean/);
    const failing = validateRoutineQuality([pushDay, legDay]);
    expect(summarizeQuality(failing)).toMatch(/warning/);
  });
});
