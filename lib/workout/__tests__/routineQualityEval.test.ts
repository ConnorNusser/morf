import { Routine } from '@/types';
import { RoutineQualityReport } from '../routineQuality';
import { aggregateQuality, EvalScenario, formatEvalReport, runEval } from '../routineQualityEval';

const report = (score: number, passed: boolean, codes: string[]): RoutineQualityReport => ({
  score,
  passed,
  issues: codes.map(code => ({ severity: 'warning', code, message: '' })),
});

const d = (name: string, exs: [string, number, number][]): Routine => ({
  id: name, name,
  exercises: exs.map(([id, sets, reps]) => ({ exerciseId: id, sets: Array.from({ length: sets }, () => ({ reps })) })),
  createdAt: new Date(0),
} as Routine);

describe('aggregateQuality', () => {
  it('computes mean, pass rate, buckets and a per-code failure histogram', () => {
    const agg = aggregateQuality([
      report(100, true, []),
      report(90, true, ['low-frequency']),
      report(60, false, ['ordering', 'muscle-gap']),
    ]);
    expect(agg.n).toBe(3);
    expect(agg.meanScore).toBe(83); // round((100+90+60)/3)
    expect(agg.passRate).toBeCloseTo(2 / 3);
    expect(agg.scoreBuckets).toEqual({ '90-100': 2, '70-89': 0, '<70': 1 });
    const rates = Object.fromEntries(agg.issueRate.map(i => [i.code, i.count]));
    expect(rates).toMatchObject({ ordering: 1, 'muscle-gap': 1, 'low-frequency': 1 });
  });

  it('handles an empty set without dividing by zero', () => {
    expect(aggregateQuality([]).meanScore).toBe(0);
  });
});

describe('runEval', () => {
  it('runs a (mock) generator across scenarios and aggregates quality', async () => {
    const good = [
      d('Push', [['overhead-press-barbell', 4, 6], ['dip-bodyweight', 3, 10], ['lateral-raise-dumbbells', 3, 12], ['flyes-dumbbells', 3, 12]]),
      d('Pull', [['pull-up-bodyweight', 4, 8], ['deadlift-barbell', 3, 5], ['bicep-curl-barbell', 3, 12]]),
      d('Legs', [['squat-barbell', 4, 6], ['romanian-deadlift-barbell', 3, 8], ['leg-extension-machine', 3, 12], ['leg-curl-machine', 3, 12]]),
    ];
    const scenarios: EvalScenario[] = [
      { goal: 'general', daysPerWeek: 3, label: 'general/3d' },
      { goal: 'strength', daysPerWeek: 3, label: 'strength/3d' },
    ];
    const res = await runEval(async () => good, scenarios);
    expect(res.perScenario).toHaveLength(2);
    expect(res.aggregate.n).toBe(2);
    expect(res.aggregate.meanScore).toBeGreaterThanOrEqual(90);
    expect(formatEvalReport(res.aggregate)).toMatch(/mean=\d+\/100/);
  });
});
