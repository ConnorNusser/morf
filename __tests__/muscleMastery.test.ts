import { UserProgress } from '../types';
import { computeMuscleMastery } from '../lib/gamification/muscleMastery';
import { getStrengthTier } from '../lib/data/strengthStandards';

function lift(workoutId: string, percentile: number): UserProgress {
  return {
    workoutId,
    personalRecord: 0,
    percentileRanking: percentile,
    strengthLevel: '',
    lastUpdated: new Date(),
  } as unknown as UserProgress;
}

describe('computeMuscleMastery', () => {
  it('maps featured lifts to their primary muscle group with the right tier', () => {
    const out = computeMuscleMastery([
      lift('bench-press-barbell', 70), // chest
      lift('squat-barbell', 60), // legs
      lift('overhead-press-barbell', 50), // shoulders
      lift('bicep-curl-barbell', 40), // arms
    ]);
    const get = (g: string) => out.find(m => m.group === g);
    expect(get('chest')?.percentile).toBe(70);
    expect(get('chest')?.tier).toBe(getStrengthTier(70));
    expect(get('legs')?.percentile).toBe(60);
    expect(get('shoulders')?.percentile).toBe(50);
    expect(get('arms')?.percentile).toBe(40);
  });

  it('averages multiple lifts in the same group', () => {
    const out = computeMuscleMastery([
      lift('bench-press-barbell', 70),
      lift('incline-bench-press-barbell', 80),
    ]);
    const chest = out.find(m => m.group === 'chest')!;
    expect(chest.percentile).toBe(75);
    expect(chest.liftCount).toBe(2);
  });

  it('omits groups with no data and ignores unknown ids', () => {
    const out = computeMuscleMastery([lift('not-a-real-exercise', 90)]);
    expect(out).toEqual([]);
  });
});
