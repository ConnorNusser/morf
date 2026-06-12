import { LiftPR } from '../lib/gamification/personalRecords';
import { computeStrengthMilestones } from '../lib/gamification/strengthMilestones';

function pr(exerciseId: string, estimatedOneRM: number): LiftPR {
  return { exerciseId, name: exerciseId, estimatedOneRM, topWeight: 0, topReps: 0, date: new Date(), unit: 'lbs' };
}

describe('computeStrengthMilestones', () => {
  it('returns nothing without bodyweight', () => {
    expect(computeStrengthMilestones([pr('bench-press-barbell', 225)], 0)).toEqual([]);
  });

  it('unlocks ratios at/under the lift and reports progress', () => {
    // 225 bench at 180 bw = 1.25x
    const out = computeStrengthMilestones([pr('bench-press-barbell', 225)], 180);
    const one = out.find(a => a.id === 'bw-bench-press-barbell-1')!;
    const onefive = out.find(a => a.id === 'bw-bench-press-barbell-1.5')!;
    expect(one.unlocked).toBe(true); // 225 >= 180
    expect(one.title).toBe('1× Bench');
    expect(onefive.unlocked).toBe(false); // 225 < 270
    expect(onefive.progress).toBeCloseTo(225 / 270, 2);
    expect(onefive.current).toBe(125); // 125% of bodyweight
    expect(onefive.target).toBe(150);
  });

  it('still lists milestones for untrained lifts (as locked goals)', () => {
    const out = computeStrengthMilestones([], 180);
    expect(out.length).toBe(8); // 4 lifts x 2 ratios
    expect(out.every(a => !a.unlocked)).toBe(true);
  });
});
