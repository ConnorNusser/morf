import { gradeE1rm } from '@/lib/history/liftProgress';
import { calculateStrengthPercentile } from '@/lib/data/strengthStandards';
import { MAIN_LIFTS } from '@/types';

const GRADING = { bodyweightLbs: 180, gender: 'male' as const, age: 28 };

describe('gradeE1rm weight-to-next-tier (the History/completion card line)', () => {
  it('gapWeight is the lbs still to lift, and lifting it enters the next tier', () => {
    const grade = gradeE1rm(MAIN_LIFTS.BENCH_PRESS, 200, 'lbs', GRADING)!;
    expect(grade.nextTier).not.toBeNull();
    expect(grade.gapWeight).toBeGreaterThanOrEqual(1);
    expect(grade.targetWeight).toBe(grade.e1rm + grade.gapWeight!);

    const pctAtTarget = calculateStrengthPercentile(
      grade.targetWeight!, GRADING.bodyweightLbs, GRADING.gender, MAIN_LIFTS.BENCH_PRESS, GRADING.age,
    );
    expect(pctAtTarget).toBeGreaterThanOrEqual(grade.percentile);
  });

  it('converts the gap into kg when the display unit is kg', () => {
    const lbs = gradeE1rm(MAIN_LIFTS.SQUAT, 315, 'lbs', GRADING)!;
    const kg = gradeE1rm(MAIN_LIFTS.SQUAT, 315, 'kg', GRADING)!;
    expect(kg.gapWeight).toBeLessThan(lbs.gapWeight!); // kg numbers are smaller
    expect(kg.nextTier).toBe(lbs.nextTier);
  });

  it('returns no target at the top of the ladder', () => {
    const grade = gradeE1rm(MAIN_LIFTS.BENCH_PRESS, 700, 'lbs', GRADING)!;
    expect(grade.nextTier).toBeNull();
    expect(grade.gapWeight).toBeNull();
  });
});
