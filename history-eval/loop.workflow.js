export const meta = {
  name: 'history-improvement-loop',
  description: 'Autonomous N-iteration improvement loop over the history page (self-applying, gate-guarded, plateau-stopping)',
  phases: [
    { title: 'Diagnose', detail: 'pick the highest-leverage weakness (or declare plateau)' },
    { title: 'Propose & Gate', detail: 'candidate diffs, each tsc+test+lint gated in isolation' },
    { title: 'Judge', detail: 'score gated survivors on the subjective rubric dims' },
    { title: 'Apply', detail: 'land the winner behind the gate + update the scoreboard' },
  ],
}

// ── config ───────────────────────────────────────────────────────────────────
const REPO = '/Users/connor/repo/morph'
const NODE_MODULES = '/Users/connor/repo/morph/node_modules'
const MAX = (args && args.maxIterations) || 100
const PLATEAU_STOP = (args && args.plateauStop) || 3
const N_CANDIDATES = (args && args.candidates) || 3

const GATE =
  'node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS" ; ' +
  'npx eslint . --ext .ts,.tsx --max-warnings 0 >/dev/null 2>&1 && echo ESLINT_OK || echo ESLINT_FAIL ; ' +
  'node_modules/.bin/jest 2>&1 | tail -3'

const RUBRIC = `Weighted rubric (1-5): 1 Correctness (w3, objective), 2 No-crash (w3, objective),
3 Empty/edge states (w2, objective), 4 Performance (w1, objective), 5 Information hierarchy (w2, subjective),
6 Visual consistency (w1, subjective), 7 Actionability (w2, subjective).`

const SCENARIOS = `9 scenarios in history-eval/fixtures.ts: empty, single, sparse, lapsed, kgUnit, bodyweight, prHeavy, dense, corrupt.`

const SURFACE = `History page = app/(tabs)/history.tsx (two tabs: workouts/exercises) + components/history/*
(HistoryHero, MuscleFocusWidget, WorkoutCard, ExerciseCard, WorkoutDetailModal, ExerciseHistoryModal,
AuroraSurface, liftSeries.ts). Some derivation is inline in useMemo bodies — extract to a pure lib module
(RN-free) when you touch it so the node gate can assert it, and add a golden in history-eval.`

const GATE_RULE = `The GATE = tsc 0 errors AND eslint clean (ESLINT_OK) AND every jest suite passing.
This runs ALL 9 scenarios' correctness/no-crash asserts, so it is the cross-scenario regression guard:
a change that breaks ANY scenario objectively cannot pass. If you add derivation logic, add/extend a
golden assertion in history-eval so it is actually checked.`

// ── schemas ───────────────────────────────────────────────────────────────────
const DIAGNOSE_SCHEMA = {
  type: 'object',
  required: ['worthwhile', 'weakestLever', 'currentScore', 'rationale'],
  properties: {
    worthwhile: { type: 'boolean', description: 'true only if a concrete, meaningful improvement remains' },
    currentScore: { type: 'number', description: 'weakest lever current rubric score 1-5' },
    weakestLever: {
      type: 'object',
      required: ['scenario', 'dimension', 'why', 'fixSketch'],
      properties: {
        scenario: { type: 'string' },
        dimension: { type: 'string' },
        why: { type: 'string' },
        fixSketch: { type: 'string', description: 'concrete direction for the fix, citing files' },
      },
    },
    rationale: { type: 'string' },
  },
}

const CANDIDATE_SCHEMA = {
  type: 'object',
  required: ['strategy', 'filesTouched', 'gatePassed', 'diff', 'notes'],
  properties: {
    strategy: { type: 'string' },
    filesTouched: { type: 'array', items: { type: 'string' } },
    gatePassed: { type: 'boolean' },
    diff: { type: 'string' },
    notes: { type: 'string' },
  },
}

const JUDGE_SCHEMA = {
  type: 'object',
  required: ['aggregate', 'verdict'],
  properties: {
    aggregate: { type: 'number', description: 'weighted mean of subjective dims 5,6,7 (w2,w1,w2), 1-5' },
    verdict: { type: 'string' },
  },
}

const APPLY_SCHEMA = {
  type: 'object',
  required: ['applied', 'gatePassed', 'commit', 'notes'],
  properties: {
    applied: { type: 'boolean' },
    gatePassed: { type: 'boolean' },
    commit: { type: 'string' },
    notes: { type: 'string' },
  },
}

const ANGLES = [
  'Minimal, surgical fix — the smallest change that resolves the weakness, fewest files.',
  'Extract the relevant inline derivation into a pure RN-free lib module and cover it with a new golden assertion in history-eval, raising the assertable ceiling while fixing the weakness.',
  'Best-UX fix — improve what the user actually sees for this scenario (empty state, hierarchy, actionable insight), consistent with the existing design-system tokens.',
]

// ── run ────────────────────────────────────────────────────────────────────────
const addressed = [] // {scenario, dimension} already fixed — do not repeat
const failed = [] // levers where no candidate could pass the gate — do not retry
const ledger = []
let plateau = 0
let accepted = 0

for (let iter = 1; iter <= MAX && plateau < PLATEAU_STOP; iter++) {
  // ---- Diagnose ----
  phase(`Iter ${iter} · Diagnose`)
  const avoid = [...addressed, ...failed]
  const diag = await agent(
    `Diagnose the morph HISTORY PAGE and pick the single highest-leverage weakness to fix NEXT.

Repo: ${REPO} (cwd). ${SURFACE}
${SCENARIOS}
${RUBRIC}

Already addressed or unfixable — DO NOT pick these again: ${avoid.length ? JSON.stringify(avoid) : '(none yet)'}
Recent commits show prior fixes: run \`git log --oneline -15\` and read history-eval/scoreboard.json to see what's done.

Steps:
1. Confirm baseline is green: \`node_modules/.bin/jest history-eval/__tests__/correctness.test.ts 2>&1 | tail -2\`.
2. Read app/(tabs)/history.tsx and components/history/*.
3. For each scenario reason about how it renders (data + JSX) and find the biggest remaining rubric weakness.
4. Pick the SINGLE weakest lever NOT in the avoid list. Give a concrete fixSketch citing files/lines.
5. Set worthwhile=false ONLY if nothing meaningful remains (every scenario is genuinely solid, weakest dim >= 4 and subjective). Be honest — do not invent busywork, but do not stop while real flaws remain.

Be specific to THIS code. No generic advice.`,
    { schema: DIAGNOSE_SCHEMA, phase: `Iter ${iter} · Diagnose`, label: `diagnose:${iter}` }
  )

  if (!diag || !diag.worthwhile) {
    plateau++
    ledger.push({ iter, result: 'plateau', reason: diag ? diag.rationale : 'diagnose failed', plateau })
    log(`Iter ${iter}: no worthwhile lever (${plateau}/${PLATEAU_STOP} toward stop).`)
    continue
  }

  const target = diag.weakestLever
  log(`Iter ${iter}: target ${target.scenario} × ${target.dimension} (cur ${diag.currentScore}/5) — ${target.why.slice(0, 90)}`)

  // ---- Propose & Gate (candidates in isolated worktrees) ----
  phase(`Iter ${iter} · Propose & Gate`)
  const candidates = await parallel(
    ANGLES.slice(0, N_CANDIDATES).map((angle, i) => () =>
      agent(
        `Implement candidate #${i + 1} to improve the morph HISTORY PAGE.

TARGET: scenario "${target.scenario}", dimension "${target.dimension}". Why: ${target.why}
FIX DIRECTION: ${target.fixSketch}
YOUR ANGLE: ${angle}

You are in an ISOLATED git worktree copy. Setup FIRST: if ./node_modules is missing, run \`ln -s ${NODE_MODULES} node_modules\`.

Then:
1. Implement a real, shippable change matching surrounding code style — no placeholders/TODOs.
2. ${GATE_RULE}
3. Make the FULL gate pass: \`${GATE}\`
4. Return: strategy (what + why it fixes the target), filesTouched, gatePassed (true only if the full gate passed), the full \`git diff HEAD\` as diff, and notes on tradeoffs/risks.

If you cannot pass the gate, return gatePassed:false with your diff and the blocker in notes. Do NOT commit.`,
        { schema: CANDIDATE_SCHEMA, isolation: 'worktree', phase: `Iter ${iter} · Propose & Gate`, label: `cand:${iter}.${i + 1}` }
      )
    )
  )

  const gated = candidates.filter((c) => c && c.gatePassed && c.diff && c.diff.trim())
  if (!gated.length) {
    failed.push({ scenario: target.scenario, dimension: target.dimension })
    plateau++
    ledger.push({ iter, target, result: 'no-gate', plateau })
    log(`Iter ${iter}: no candidate passed the gate (${plateau}/${PLATEAU_STOP} toward stop).`)
    continue
  }

  // ---- Judge (pick best of gated survivors) ----
  let winner
  if (gated.length === 1) {
    winner = { ...gated[0], agg: null }
  } else {
    phase(`Iter ${iter} · Judge`)
    const judged = await parallel(
      gated.map((c, i) => () =>
        agent(
          `Judge candidate #${i + 1}'s change to the morph HISTORY PAGE (target scenario "${target.scenario}", dimension "${target.dimension}").
${RUBRIC}
Strategy: ${c.strategy}
Diff:
\`\`\`diff
${(c.diff || '').slice(0, 12000)}
\`\`\`
Be a skeptical judge: reward only real improvement, penalize regressions/complexity/over-engineering.
Score the subjective dims (5 hierarchy, 6 visual, 7 actionability) for the page AFTER this change and return their weighted mean (w2,w1,w2) as aggregate, plus a one-line verdict.`,
          { schema: JUDGE_SCHEMA, phase: `Iter ${iter} · Judge`, label: `judge:${iter}.${i + 1}` }
        ).then((j) => ({ ...c, agg: j ? j.aggregate : 0 }))
      )
    )
    winner = judged.slice().sort((a, b) => (b.agg || 0) - (a.agg || 0))[0]
  }

  // ---- Apply winner to main worktree behind the gate + update scoreboard ----
  phase(`Iter ${iter} · Apply`)
  const apply = await agent(
    `Land the winning history-page improvement into the main worktree at ${REPO} (your cwd), then re-verify and commit.

WINNER strategy: ${winner.strategy}
Files touched: ${JSON.stringify(winner.filesTouched)}
Judge aggregate: ${winner.agg == null ? 'n/a (sole survivor)' : winner.agg}
Target: ${target.scenario} × ${target.dimension}

Unified diff to apply (produced in an isolated worktree, so paths may be absolute — strip to repo-relative):
\`\`\`diff
${(winner.diff || '').slice(0, 16000)}
\`\`\`

Steps:
1. Ensure the working tree is clean (prior iterations are committed). If not, stop and report applied:false.
2. Apply the change. Prefer \`git apply\`; if it does not apply cleanly, RECONSTRUCT the change by hand from the strategy + diff (edit the same files to the same end state). New files in the diff must be created.
3. Run the FULL gate and it MUST pass: \`${GATE}\` (tsc 0 errors, ESLINT_OK, all jest suites passing). If it fails, fix minimally; if you cannot, \`git checkout -- .\` / remove new files to restore a clean tree and report applied:false with the blocker.
4. Update history-eval/scoreboard.json: append to iterations[] an entry {n:${iter}, target, winner:{strategy(short), files, judgeAggregate}, gate:{...}} and set best["${target.scenario}"] to max(existing, ${winner.agg == null ? 'currentScore-based estimate' : winner.agg}).
5. Commit ALL changes (the fix + scoreboard) with a clear message: "fix(history): <what> (loop iter ${iter})". Do NOT push.
6. Return applied, gatePassed, the commit sha (\`git rev-parse --short HEAD\`), and notes.`,
    { schema: APPLY_SCHEMA, phase: `Iter ${iter} · Apply`, label: `apply:${iter}` }
  )

  if (apply && apply.applied && apply.gatePassed) {
    accepted++
    plateau = 0
    addressed.push({ scenario: target.scenario, dimension: target.dimension })
    ledger.push({ iter, target, result: 'accepted', commit: apply.commit, judgeAggregate: winner.agg })
    log(`Iter ${iter}: ✓ accepted ${apply.commit} — ${target.scenario}×${target.dimension} (total accepted: ${accepted})`)
  } else {
    // apply failed — treat as a miss but don't blacklist the lever (it was gate-passable in isolation)
    plateau++
    ledger.push({ iter, target, result: 'apply-failed', plateau, notes: apply && apply.notes })
    log(`Iter ${iter}: apply failed (${plateau}/${PLATEAU_STOP} toward stop) — ${apply && apply.notes}`)
  }
}

const stopReason = plateau >= PLATEAU_STOP ? `plateau (${PLATEAU_STOP} consecutive non-improvements)` : `reached maxIterations ${MAX}`
log(`Loop done: ${accepted} improvements accepted. Stopped: ${stopReason}.`)

return {
  accepted,
  iterationsRun: ledger.length,
  stopReason,
  addressed,
  unfixable: failed,
  ledger,
}
