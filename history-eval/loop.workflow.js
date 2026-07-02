export const meta = {
  name: 'history-improvement-loop',
  description: 'One diagnose→propose→gate→judge→select pass over the history page',
  phases: [
    { title: 'Diagnose', detail: 'score current state, pick the weakest lever' },
    { title: 'Propose & Gate', detail: 'N candidate diffs, each tsc+test gated in isolation' },
    { title: 'Judge', detail: '3 judges score each surviving candidate on subjective dims' },
  ],
}

// ── shared context handed to every agent ────────────────────────────────────
const REPO = '/Users/connor/repo/morph-worktrees/history-eval'
const NODE_MODULES = '/Users/connor/repo/morph/node_modules'
const GATE = 'node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS"; node_modules/.bin/jest 2>&1 | tail -3'

const RUBRIC = `Weighted rubric (1-5 each): 1 Correctness (w3, objective), 2 No-crash (w3, objective),
3 Empty/edge states (w2, objective), 4 Performance (w1, objective), 5 Information hierarchy (w2, subjective),
6 Visual consistency (w1, subjective), 7 Actionability (w2, subjective).`

const SCENARIOS = `9 scenarios in history-eval/fixtures.ts: empty, single, sparse, lapsed, kgUnit,
bodyweight, prHeavy, dense, corrupt.`

const SURFACE = `History page = app/(tabs)/history.tsx (~994 lines, two tabs: workouts/exercises) plus
components/history/ (HistoryHero, MuscleFocusWidget, WorkoutCard, ExerciseCard, WorkoutDetailModal,
ExerciseHistoryModal, AuroraSurface). Much derivation is inline in useMemo bodies (streak, getImprovement,
sparkline, delta) — NOT yet extracted/exported, so it's currently unassertable by the node gate.`

// ── schemas ─────────────────────────────────────────────────────────────────
const DIAGNOSE_SCHEMA = {
  type: 'object',
  required: ['perScenario', 'weakestLever', 'rationale'],
  properties: {
    perScenario: {
      type: 'array',
      items: {
        type: 'object',
        required: ['scenario', 'weakestDimension', 'score', 'critique'],
        properties: {
          scenario: { type: 'string' },
          weakestDimension: { type: 'string' },
          score: { type: 'number' },
          critique: { type: 'string' },
        },
      },
    },
    weakestLever: {
      type: 'object',
      required: ['scenario', 'dimension', 'why'],
      properties: {
        scenario: { type: 'string' },
        dimension: { type: 'string' },
        why: { type: 'string' },
      },
    },
    rationale: { type: 'string' },
  },
}

const CANDIDATE_SCHEMA = {
  type: 'object',
  required: ['strategy', 'filesTouched', 'gatePassed', 'tscErrors', 'testsPassed', 'diff', 'notes'],
  properties: {
    strategy: { type: 'string' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    gatePassed: { type: 'boolean' },
    tscErrors: { type: 'number' },
    testsPassed: { type: 'boolean' },
    diff: { type: 'string' },
    notes: { type: 'string' },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  required: ['perDimension', 'aggregate', 'verdict'],
  properties: {
    perDimension: {
      type: 'array',
      items: {
        type: 'object',
        required: ['dimension', 'score', 'critique'],
        properties: {
          dimension: { type: 'string' },
          score: { type: 'number' },
          critique: { type: 'string' },
        },
      },
    },
    aggregate: { type: 'number' },
    verdict: { type: 'string' },
  },
}

// ── run ──────────────────────────────────────────────────────────────────────
const N = (args && args.candidates) || 3
const forcedTarget = args && args.target // optional {scenario, dimension}

phase('Diagnose')
const diag = await agent(
  `You are diagnosing the morph app's HISTORY PAGE to find the single highest-leverage weakness to fix next.

Repo: ${REPO} (cwd). ${SURFACE}
${SCENARIOS}
${RUBRIC}

Do this:
1. Run the objective gate to confirm the baseline is green: \`node_modules/.bin/jest history-eval/__tests__/correctness.test.ts 2>&1 | tail -3\`
2. Read app/(tabs)/history.tsx and the components/history/* files.
3. For each scenario, reason about how the page renders it (data + JSX) and score its WEAKEST rubric dimension, with a one-line critique of the concrete flaw.
4. Pick the SINGLE weakest lever — the (scenario, dimension) pair where a fix would most improve the page — and explain why it's the biggest lever, not just the lowest score.

Be concrete and specific to THIS code (cite files/lines). No generic advice.`,
  { schema: DIAGNOSE_SCHEMA, phase: 'Diagnose' }
)

const target = forcedTarget || diag.weakestLever
log(`Target lever: ${target.scenario} × ${target.dimension} — ${target.why || diag.rationale}`)

// distinct angles so candidates don't converge on the same diff
const ANGLES = [
  'Minimal, surgical fix touching the fewest files — the smallest change that resolves the weakness.',
  'Extract the relevant inline useMemo derivation into a small exported pure function in lib/ and cover it with a new golden assertion in history-eval, raising the assertable ceiling while fixing the weakness.',
  'Best-UX fix: improve what the user actually sees for this scenario (empty state, hierarchy, or actionable insight), consistent with the existing design system.',
]

phase('Propose & Gate')
const candidates = await pipeline(
  ANGLES.slice(0, N).map((angle, i) => ({ angle, i })),
  ({ angle, i }) =>
    agent(
      `You are implementing candidate #${i + 1} to improve the morph HISTORY PAGE.

TARGET WEAKNESS: scenario "${target.scenario}", dimension "${target.dimension}". Why: ${target.why}
YOUR ANGLE: ${angle}

You are in an ISOLATED git worktree copy of the repo. Setup first:
- If ./node_modules is missing: \`ln -s ${NODE_MODULES} node_modules\`

Then:
1. Implement the change. ${SURFACE}
2. Keep it real and shippable — match surrounding code style, no placeholders.
3. Run the FULL objective gate and make it pass: \`${GATE}\` (tsc must print 0 errors; jest must show all suites passing). If you added logic, add/extend a golden assertion in history-eval so it's actually checked.
4. Return: strategy (what you did + why it fixes the target), filesTouched, gatePassed (tsc 0 errors AND all tests pass), tscErrors, testsPassed, the full \`git diff\` (staged+unstaged) as diff, and notes on tradeoffs/risks.

If you cannot make the gate pass, return gatePassed:false with the diff you have and notes explaining the blocker. Do NOT commit.`,
      { schema: CANDIDATE_SCHEMA, isolation: 'worktree', phase: 'Propose & Gate', label: `candidate:${i + 1}` }
    ),
  (cand, { i }) => {
    if (!cand || !cand.gatePassed) return cand
    // judge only gated survivors; 3 independent judges, averaged
    return parallel(
      [0, 1, 2].map((j) => () =>
        agent(
          `Judge candidate #${i + 1}'s change to the morph HISTORY PAGE, targeting scenario "${target.scenario}", dimension "${target.dimension}".

${RUBRIC}

The candidate's strategy: ${cand.strategy}
Its diff:
\`\`\`diff
${(cand.diff || '').slice(0, 12000)}
\`\`\`

Score EACH subjective dimension (5 Information hierarchy, 6 Visual consistency, 7 Actionability) 1-5 for the page AFTER this change, focused on the target scenario. Be a skeptical judge — reward only real improvement, penalize regressions/complexity. Compute aggregate = weighted mean of your subjective scores (w2,w1,w2). Give a one-line verdict.`,
          { schema: JUDGE_SCHEMA, phase: 'Judge', label: `judge:${i + 1}.${j + 1}` }
        )
      )
    ).then((judges) => {
      const ok = judges.filter(Boolean)
      const agg = ok.length ? ok.reduce((s, j) => s + j.aggregate, 0) / ok.length : 0
      return { ...cand, judgeAggregate: Math.round(agg * 100) / 100, judges: ok }
    })
  }
)

// select: gated + highest judge aggregate
const gated = candidates.filter((c) => c && c.gatePassed)
const winner = gated.slice().sort((a, b) => (b.judgeAggregate || 0) - (a.judgeAggregate || 0))[0] || null

log(
  winner
    ? `Winner: judged ${winner.judgeAggregate}/5 — ${winner.strategy.slice(0, 80)}`
    : 'No candidate passed the gate.'
)

return {
  target,
  diagnosis: diag,
  candidateCount: candidates.filter(Boolean).length,
  gatedCount: gated.length,
  winner: winner && {
    strategy: winner.strategy,
    filesTouched: winner.filesTouched,
    judgeAggregate: winner.judgeAggregate,
    notes: winner.notes,
    diff: winner.diff,
  },
  runnersUp: gated
    .filter((c) => c !== winner)
    .map((c) => ({ strategy: c.strategy, judgeAggregate: c.judgeAggregate, filesTouched: c.filesTouched })),
}
