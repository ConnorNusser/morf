// Eval harness — the measurement backbone for the generation quality loop. Runs a
// scenario matrix through a generator, scores each result with the rubric, and
// aggregates into a mean score, pass rate, and (the actionable part) a failure-rate
// histogram per issue code. Generator-agnostic: pass it the deterministic fallback,
// recorded cassettes (CI-safe, no API), or the live generateValidatedProgram.
import { Routine } from '@/types';
import { RoutineQualityReport, validateRoutineQuality } from './routineQuality';

export interface EvalScenario {
  goal: string;
  daysPerWeek: number;
  label: string;
}

// A representative matrix of goal × days/week. Expand as needed.
export const EVAL_SCENARIOS: EvalScenario[] = (() => {
  const goals = ['strength', 'hypertrophy', 'powerbuilding', 'general'];
  const days = [3, 4, 5, 6];
  const out: EvalScenario[] = [];
  for (const goal of goals) for (const d of days) out.push({ goal, daysPerWeek: d, label: `${goal}/${d}d` });
  return out;
})();

export interface EvalAggregate {
  n: number;
  meanScore: number;
  passRate: number; // 0..1
  scoreBuckets: { '90-100': number; '70-89': number; '<70': number };
  // Sorted desc — the histogram that tells you which rules the generator breaks most.
  issueRate: { code: string; count: number; rate: number }[];
}

export function aggregateQuality(reports: RoutineQualityReport[]): EvalAggregate {
  const n = reports.length;
  if (n === 0) {
    return { n: 0, meanScore: 0, passRate: 0, scoreBuckets: { '90-100': 0, '70-89': 0, '<70': 0 }, issueRate: [] };
  }
  const meanScore = Math.round(reports.reduce((s, r) => s + r.score, 0) / n);
  const passRate = reports.filter(r => r.passed).length / n;

  const buckets = { '90-100': 0, '70-89': 0, '<70': 0 };
  for (const r of reports) {
    if (r.score >= 90) buckets['90-100']++;
    else if (r.score >= 70) buckets['70-89']++;
    else buckets['<70']++;
  }

  // Count how many runs hit each issue code (presence per run, not total occurrences).
  const counts = new Map<string, number>();
  for (const r of reports) {
    for (const code of new Set(r.issues.map(i => i.code))) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  const issueRate = [...counts.entries()]
    .map(([code, count]) => ({ code, count, rate: count / n }))
    .sort((a, b) => b.rate - a.rate);

  return { n, meanScore, passRate, scoreBuckets: buckets, issueRate };
}

export interface EvalResult {
  aggregate: EvalAggregate;
  perScenario: { scenario: string; score: number; passed: boolean }[];
}

// Run a generator across scenarios (× reps), scoring each with the scenario's goal.
export async function runEval(
  generate: (s: EvalScenario) => Promise<Routine[]>,
  scenarios: EvalScenario[] = EVAL_SCENARIOS,
  reps = 1,
): Promise<EvalResult> {
  const reports: RoutineQualityReport[] = [];
  const perScenario: EvalResult['perScenario'] = [];
  for (const s of scenarios) {
    for (let i = 0; i < reps; i++) {
      const routines = await generate(s);
      const report = validateRoutineQuality(routines, { goal: s.goal });
      reports.push(report);
      perScenario.push({ scenario: s.label, score: report.score, passed: report.passed });
    }
  }
  return { aggregate: aggregateQuality(reports), perScenario };
}

// One-screen report for logs / the prompt-evolution workflow.
export function formatEvalReport(agg: EvalAggregate): string {
  const lines = [
    `Eval: n=${agg.n}  mean=${agg.meanScore}/100  pass=${Math.round(agg.passRate * 100)}%`,
    `  buckets  90-100:${agg.scoreBuckets['90-100']}  70-89:${agg.scoreBuckets['70-89']}  <70:${agg.scoreBuckets['<70']}`,
    `  top failures:`,
    ...agg.issueRate.slice(0, 8).map(i => `    ${i.code.padEnd(20)} ${Math.round(i.rate * 100)}% (${i.count})`),
  ];
  return lines.join('\n');
}
