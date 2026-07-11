import { ALL_MAIN_LIFTS, ALL_FEATURED_SECONDARY_LIFTS } from '@/types';
import { EXERCISE_CATALOG, MAIN_LIFT_EXERCISES } from '@/lib/workout/exerciseCatalog';

// exercises.json's isMainLift flags and the type-level id list are defined
// independently — this fossilizes their agreement so flagging a new exercise
// (or renaming an id) can't silently diverge leaderboards from the catalog.
describe('catalog ↔ types invariants', () => {
  it('json isMainLift flags exactly match ALL_MAIN_LIFTS', () => {
    const flagged = MAIN_LIFT_EXERCISES.map(e => e.id).sort();
    expect(flagged).toEqual([...ALL_MAIN_LIFTS].sort());
  });

  it('every featured lift id exists in the catalog', () => {
    const ids = new Set(EXERCISE_CATALOG.map(e => e.id));
    for (const id of [...ALL_MAIN_LIFTS, ...ALL_FEATURED_SECONDARY_LIFTS]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});
