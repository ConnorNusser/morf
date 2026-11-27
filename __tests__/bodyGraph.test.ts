import { ALL_BODY_REGIONS, BODY_REGIONS, regionsForExercise } from '@/lib/data/bodyRegions';
import { EXERCISE_REGIONS } from '@/lib/data/exerciseRegions';
import { calculateStrengthPercentile, getStrengthTier, MALE_STANDARDS } from '@/lib/data/strengthStandards';
import {
  computeBodyGraph,
  e1rmForPercentile,
  findLaggingRegion,
  RegionState,
  trainingLevel,
} from '@/lib/gamification/bodyGraph';
import { EXERCISE_CATALOG } from '@/lib/workout/exerciseCatalog';
import { LoggedWorkout } from '@/types';

const NOW = new Date(2026, 5, 30, 12);
const profile = { bodyWeightLbs: 180, gender: 'male' as const, age: 30 };

function workout(id: string, daysAgo: number, exs: { id: string; weight: number; reps: number; sets?: number }[]): LoggedWorkout {
  return {
    id,
    title: id,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    exercises: exs.map(({ id: exId, weight, reps, sets = 3 }) => ({
      id: exId,
      sets,
      reps: String(reps),
      isCompleted: true,
      completedSets: Array.from({ length: sets }, (_, i) => ({ setNumber: i + 1, weight, reps, unit: 'lbs', completed: true })),
    })),
  } as unknown as LoggedWorkout;
}

const byRegion = (states: RegionState[]) => new Map(states.map(s => [s.region, s]));

describe('exercise → region map', () => {
  const groupOf = new Map(BODY_REGIONS.map(r => [r.id, r.group]));

  it('covers every catalog exercise with at least one primary region', () => {
    for (const ex of EXERCISE_CATALOG) {
      expect(EXERCISE_REGIONS[ex.id]?.[0].length ?? 0).toBeGreaterThan(0);
    }
  });

  it('has no entries for ids missing from the catalog', () => {
    const ids = new Set(EXERCISE_CATALOG.map(e => e.id));
    expect(Object.keys(EXERCISE_REGIONS).filter(id => !ids.has(id))).toEqual([]);
  });

  // The catalog files shrugs under shoulders; anatomically they're traps.
  const KNOWN_REGROUPED = new Set(['shrugs-barbell', 'shrugs-dumbbells']);

  it("primary regions roll up to the exercise's own muscle groups", () => {
    for (const ex of EXERCISE_CATALOG) {
      const groups = new Set([...ex.primaryMuscles, ...ex.secondaryMuscles]);
      if (groups.has('full-body') || KNOWN_REGROUPED.has(ex.id)) continue;
      for (const r of EXERCISE_REGIONS[ex.id][0]) {
        expect({ id: ex.id, region: r, ok: groups.has(groupOf.get(r)!) }).toEqual({ id: ex.id, region: r, ok: true });
      }
    }
  });

  it('never lists a region as both primary and secondary', () => {
    for (const [id, [p, s]] of Object.entries(EXERCISE_REGIONS)) {
      expect({ id, overlap: p.filter(r => s.includes(r)) }).toEqual({ id, overlap: [] });
    }
  });

  it('every rankable lift has a primary region', () => {
    for (const id of Object.keys(MALE_STANDARDS)) {
      if (EXERCISE_CATALOG.some(e => e.id === id)) expect(EXERCISE_REGIONS[id][0].length).toBeGreaterThan(0);
    }
  });

  it('falls back to muscle groups for custom exercises', () => {
    expect(regionsForExercise({ id: 'custom-x', primaryMuscles: ['arms'], secondaryMuscles: ['chest'] })).toEqual({
      primary: ['biceps', 'triceps'],
      secondary: ['chest'],
    });
  });
});

describe('computeBodyGraph', () => {
  it('returns all 16 regions, unranked and untrained with no history', () => {
    const states = computeBodyGraph([], profile, NOW);
    expect(states.map(s => s.region)).toEqual(ALL_BODY_REGIONS);
    expect(states.every(s => s.tier === null && s.training === 'none' && !s.fresh)).toBe(true);
  });

  it('ranks a region from its primary lifts and matches the lift percentile', () => {
    const states = byRegion(computeBodyGraph([workout('a', 1, [{ id: 'bench-press-barbell', weight: 185, reps: 5 }])], profile, NOW));
    const chest = states.get('chest')!;
    expect(chest.tier).not.toBeNull();
    expect(chest.lifts.map(l => l.exerciseId)).toEqual(['bench-press-barbell']);
    expect(chest.percentile).toBe(chest.lifts[0].percentile);
    // Triceps only gets secondary credit from bench: volume, no tier.
    expect(states.get('triceps')!.tier).toBeNull();
    expect(states.get('triceps')!.setsPerWeek).toBeGreaterThan(0);
  });

  it('weights lifts by lifetime sets in the region average', () => {
    const states = byRegion(
      computeBodyGraph(
        [workout('a', 1, [
          { id: 'bench-press-barbell', weight: 225, reps: 5, sets: 9 },
          { id: 'chest-fly-machine', weight: 60, reps: 12, sets: 1 },
        ])],
        profile,
        NOW,
      ),
    );
    const chest = states.get('chest')!;
    const [a, b] = chest.lifts;
    const expected = Math.round((a.percentile * a.sets + b.percentile * b.sets) / (a.sets + b.sets));
    expect(chest.percentile).toBe(expected);
  });

  it('credits primary 1.0 and secondary 0.5 sets over a 4-week window', () => {
    const ws = [
      workout('in', 3, [{ id: 'bench-press-barbell', weight: 135, reps: 8, sets: 8 }]),
      workout('out', 40, [{ id: 'bench-press-barbell', weight: 135, reps: 8, sets: 8 }]), // outside window
    ];
    const states = byRegion(computeBodyGraph(ws, profile, NOW));
    expect(states.get('chest')!.setsPerWeek).toBe(2);
    expect(states.get('triceps')!.setsPerWeek).toBe(1);
  });

  it('marks regions trained within 72h as fresh', () => {
    const states = byRegion(
      computeBodyGraph(
        [workout('a', 1, [{ id: 'squat-barbell', weight: 225, reps: 5 }]), workout('b', 5, [{ id: 'row-barbell', weight: 135, reps: 8 }])],
        profile,
        NOW,
      ),
    );
    expect(states.get('quads')!.fresh).toBe(true);
    expect(states.get('upper-back')!.fresh).toBe(false);
    expect(states.get('upper-back')!.lastTrained).not.toBeNull();
  });

  it('skips tiers without bodyweight but still reports volume', () => {
    const states = byRegion(computeBodyGraph([workout('a', 1, [{ id: 'bench-press-barbell', weight: 185, reps: 5 }])], { ...profile, bodyWeightLbs: 0 }, NOW));
    expect(states.get('chest')!.tier).toBeNull();
    expect(states.get('chest')!.setsPerWeek).toBeGreaterThan(0);
  });

  it('next-tier target actually reaches the next tier', () => {
    const states = byRegion(computeBodyGraph([workout('a', 1, [{ id: 'bench-press-barbell', weight: 155, reps: 5 }])], profile, NOW));
    const next = states.get('chest')!.next!;
    expect(next.exerciseId).toBe('bench-press-barbell');
    expect(next.deltaLbs).toBeGreaterThan(0);
    const pct = calculateStrengthPercentile(next.targetE1rmLbs, 180, 'male', 'bench-press-barbell', 30);
    const pctBelow = calculateStrengthPercentile(next.targetE1rmLbs - 1, 180, 'male', 'bench-press-barbell', 30);
    expect(pct).toBeGreaterThan(states.get('chest')!.percentile!);
    expect(pctBelow).toBeLessThan(pct);
  });

  it('e1rmForPercentile returns null when the standards cap below the target', () => {
    expect(e1rmForPercentile(100, 'bench-press-barbell', profile)).toBeNull();
  });
});

describe('trainingLevel + findLaggingRegion', () => {
  it('bands weekly sets', () => {
    expect([0, 3, 6, 11.9, 12].map(trainingLevel)).toEqual(['none', 'light', 'moderate', 'moderate', 'high']);
  });

  const region = (r: RegionState['region'], percentile: number | null) =>
    ({ region: r, percentile, tier: percentile === null ? null : getStrengthTier(percentile) }) as RegionState;

  it('flags the weakest region two or more sub-tiers below overall', () => {
    // Overall 65 = B+; hamstrings 35 = C (4 below), biceps 56 = B (1 below).
    const lag = findLaggingRegion([region('hamstrings', 35), region('biceps', 56), region('abs', null)], 65);
    expect(lag?.region).toBe('hamstrings');
  });

  it('returns null when nothing trails enough or the user is unranked', () => {
    expect(findLaggingRegion([region('biceps', 56)], 65)).toBeNull();
    expect(findLaggingRegion([region('hamstrings', 10)], 0)).toBeNull();
  });
});
