import { TIER_COLORS } from '@/lib/data/strengthStandards';
import { trend } from '@/lib/ui/tokens';
import {
  calculatePPLBreakdown,
  dominantPPL,
  pplForExercise,
  PPL_COLORS,
} from '@/lib/data/pplCategories';
import { getCatalogExercise } from '@/lib/workout/exerciseCatalog';
import { LoggedWorkout } from '@/types';

const workoutOf = (ids: string[]): LoggedWorkout =>
  ({ exercises: ids.map(id => ({ id })) } as unknown as LoggedWorkout);

describe('pplForExercise', () => {
  it('sends triceps arms exercises to push', () => {
    for (const id of [
      'tricep-pushdown-cables',
      'skull-crushers-dumbbells',
      'overhead-tricep-extension-cables',
      'tricep-kickback-dumbbells',
      'diamond-push-up-bodyweight',
    ]) {
      expect(pplForExercise(getCatalogExercise(id))).toBe('push');
    }
  });

  it('keeps biceps arms exercises on pull', () => {
    expect(pplForExercise(getCatalogExercise('bicep-curl-barbell'))).toBe('pull');
    expect(pplForExercise(getCatalogExercise('hammer-curl-dumbbells'))).toBe('pull');
  });

  it('maps non-arms muscles straight through', () => {
    expect(pplForExercise(getCatalogExercise('bench-press-barbell'))).toBe('push');
    expect(pplForExercise(getCatalogExercise('lat-pulldown-cables'))).toBe('pull');
    expect(pplForExercise(getCatalogExercise('squat-barbell'))).toBe('legs');
    expect(pplForExercise(null)).toBeNull();
  });
});

describe('dominantPPL', () => {
  it('classifies a push day with triceps accessories as push', () => {
    // 3 presses + 4 triceps accessories used to count push 3 / pull 4 → Pull dot.
    const day = workoutOf([
      'bench-press-barbell',
      'incline-bench-press-barbell',
      'overhead-press-barbell',
      'tricep-pushdown-cables',
      'skull-crushers-dumbbells',
      'overhead-tricep-extension-cables',
      'tricep-kickback-dumbbells',
    ]);
    expect(dominantPPL([day])).toBe('push');
  });

  it('still classifies pull days as pull', () => {
    const day = workoutOf([
      'lat-pulldown-cables',
      'bicep-curl-barbell',
      'hammer-curl-dumbbells',
    ]);
    expect(dominantPPL([day])).toBe('pull');
  });

  it('returns null when nothing is classifiable', () => {
    expect(dominantPPL([workoutOf(['some-custom-exercise'])])).toBeNull();
    expect(dominantPPL([])).toBeNull();
  });
});

describe('calculatePPLBreakdown', () => {
  it('counts triceps work as push by exercise name', () => {
    const { counts, total } = calculatePPLBreakdown([
      { name: 'Bench Press (Barbell)' },
      { name: 'Tricep Pushdown (Cables)' },
      { name: 'Bicep Curl (Barbell)' },
    ]);
    expect(counts).toEqual({ push: 2, pull: 1, legs: 0 });
    expect(total).toBe(3);
  });
});

describe('PPL_COLORS', () => {
  const rgb = (hex: string) => [0, 2, 4].map(i => parseInt(hex.replace('#', '').slice(i, i + 2), 16));
  const dist = (a: string, b: string) => {
    const [x, y] = [rgb(a), rgb(b)];
    return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
  };

  it('stays clearly off every strength-tier color and the trend-down red', () => {
    for (const c of Object.values(PPL_COLORS)) {
      for (const t of ['C', 'B', 'A', 'S'] as const) expect(dist(c, TIER_COLORS[t])).toBeGreaterThan(85);
      expect(dist(c, trend.down)).toBeGreaterThan(60);
    }
  });
});
