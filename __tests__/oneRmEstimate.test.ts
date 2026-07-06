import { OneRMCalculator } from '@/lib/data/strengthStandards';

describe('OneRMCalculator.estimate', () => {
  it('returns the weight itself for a single', () => {
    expect(OneRMCalculator.estimate(225, 1)).toBe(225);
  });

  it('estimates above the bar weight for a normal rep range', () => {
    expect(OneRMCalculator.estimate(100, 8)).toBeGreaterThan(100);
  });

  it('does not collapse to the bar weight past 15 reps (21-rep set bug)', () => {
    const at21 = OneRMCalculator.estimate(100, 21);
    // Regression: this used to return 100 — a 21-rep set scored like a single.
    expect(at21).toBeGreaterThan(100);
    // Clamped at the 15-rep estimate: high-rep sets credit that, no more.
    expect(at21).toBe(OneRMCalculator.estimate(100, 15));
  });

  it('never decreases as reps rise', () => {
    let prev = 0;
    for (let reps = 1; reps <= 30; reps++) {
      const cur = OneRMCalculator.estimate(100, reps);
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });
});
