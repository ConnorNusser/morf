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
    // Quarter-credit continuation: more than the 15-rep estimate, but only a
    // minimal step — never a formula runaway.
    expect(at21).toBeGreaterThan(OneRMCalculator.estimate(100, 15));
    expect(at21).toBeLessThan(OneRMCalculator.estimate(100, 15) * 1.1);
  });

  it('plateaus at an effective 20 reps so marathon sets cannot run away', () => {
    expect(OneRMCalculator.estimate(100, 35)).toBe(OneRMCalculator.estimate(100, 60));
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
