import { computeStrengthFeats } from '../lib/gamification/strengthFeats';
import { LiftPR } from '../lib/gamification/personalRecords';

function pr(exerciseId: string, estimatedOneRM: number): LiftPR {
  return { exerciseId, name: exerciseId, estimatedOneRM, topWeight: estimatedOneRM, topReps: 1, date: new Date(2026, 0, 1), unit: 'lbs' };
}

const find = (a: ReturnType<typeof computeStrengthFeats>, id: string) => a.find(x => x.id === id)!;

describe('computeStrengthFeats', () => {
  it('sums squat+bench+deadlift into the powerlifting total', () => {
    const feats = computeStrengthFeats([
      pr('squat-barbell', 405),
      pr('bench-press-barbell', 275),
      pr('deadlift-barbell', 455),
      pr('overhead-press-barbell', 185), // ignored — not part of the total
    ]);
    // 405 + 275 + 455 = 1135
    expect(find(feats, 'total-1000').current).toBe(1135);
    expect(find(feats, 'total-600').unlocked).toBe(true);
    expect(find(feats, 'total-1000').unlocked).toBe(true);
    expect(find(feats, 'total-1200').unlocked).toBe(false);
  });

  it('treats missing lifts as zero and stays locked', () => {
    const feats = computeStrengthFeats([pr('bench-press-barbell', 225)]);
    expect(find(feats, 'total-600').current).toBe(225);
    expect(feats.every(f => !f.unlocked)).toBe(true);
  });

  it('reports clamped progress toward each tier', () => {
    const feats = computeStrengthFeats([pr('squat-barbell', 300)]); // total 300
    expect(find(feats, 'total-600').progress).toBeCloseTo(0.5);
    expect(find(feats, 'total-1200').progress).toBeCloseTo(0.25);
  });
});
