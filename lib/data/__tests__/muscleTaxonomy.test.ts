import { ALL_WORKOUTS } from '@/lib/workout/workouts';
import {
  ALL_SUBMUSCLES,
  EXERCISE_SUBMUSCLES,
  getSubMuscles,
  SUBMUSCLE_GROUP,
} from '../muscleTaxonomy';

describe('muscleTaxonomy', () => {
  it('maps every rep-tracked compound/isolation exercise in the DB', () => {
    const needsMapping = ALL_WORKOUTS.filter(
      w => (w.category === 'compound' || w.category === 'isolation') && (w.trackingType ?? 'reps') === 'reps',
    );
    const missing = needsMapping.filter(w => !EXERCISE_SUBMUSCLES[w.id]).map(w => w.id);
    expect(missing).toEqual([]);
    expect(needsMapping.length).toBeGreaterThan(40);
  });

  it('every sub-muscle rolls up to a coarse group', () => {
    expect(ALL_SUBMUSCLES).toHaveLength(16);
    for (const s of ALL_SUBMUSCLES) expect(SUBMUSCLE_GROUP[s]).toBeTruthy();
  });

  it('every mapped sub-muscle is a known sub-muscle', () => {
    const valid = new Set(ALL_SUBMUSCLES);
    for (const [id, t] of Object.entries(EXERCISE_SUBMUSCLES)) {
      for (const m of [...t.primary, ...t.secondary]) {
        expect(valid.has(m)).toBe(true);
      }
      expect(t.primary.length).toBeGreaterThan(0); // every mapped lift has a primary mover
      expect(id.length).toBeGreaterThan(0);
    }
  });

  it('resolves known lifts and falls back from coarse muscles for unmapped ones', () => {
    expect(getSubMuscles('squat-barbell').primary).toContain('quads');
    expect(getSubMuscles('leg-curl-machine').primary).toEqual(['hamstrings']);
    // custom / unmapped → best-guess from coarse primary muscles
    expect(getSubMuscles('custom_xyz', ['back']).primary).toContain('lats');
    expect(getSubMuscles('custom_none', []).primary).toEqual([]);
  });
});
