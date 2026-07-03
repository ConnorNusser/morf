export const meta = {
  name: 'history-visual-loop',
  description: 'Autonomous visual-improvement loop for the History screen: render real screenshots, judge understanding-per-glance vs Robinhood, apply the winner, repeat',
  phases: [
    { title: 'Diagnose', detail: 'render current + 3-lens judge -> the highest-leverage weakness' },
    { title: 'Propose & Render', detail: 'N candidates, each edits + builds + screenshots in isolation' },
    { title: 'Judge', detail: 'vision judge each candidate pairwise vs current (meaningful vs marginal)' },
    { title: 'Apply', detail: 'land the winner if it meaningfully improves with no regression' },
  ],
}

const REPO = '/Users/connor/repo/morph'
const NM = '/Users/connor/repo/morph/node_modules'
const CAP = '/private/tmp/claude-501/-Users-connor-repo-morph-worktrees/e1764d36-4153-4339-b61b-f3d1b1d39411/scratchpad/vloop' // shared PNG dir
const SPEC = `${REPO}/visual-loop/judge-spec.md`
const MAX = (args && args.maxIterations) || 8
const PLATEAU_STOP = (args && args.plateauStop) || 2
const N_CANDIDATES = (args && args.candidates) || 2

const GATE = `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS" ; npx eslint . --ext .ts,.tsx --max-warnings 0 >/dev/null 2>&1 && echo ESLINT_OK || echo ESLINT_FAIL`

const SURFACE = `The History screen: app/(tabs)/history.tsx (two tabs, Workouts + Exercises) and
components/history/* (HistoryHero, WeeklyOverview, WorkoutCard, ExerciseCard, MuscleFocusChips,
WorkoutDetailModal, ExerciseHistoryModal) plus lib/history/*. The Exercises tab is already
near the Robinhood bar (per-lift est-1RM + green delta + sparkline) — DO NOT regress it. The
Workouts tab is the target.`

const KNOWN = `Known standing weaknesses (from the judge dry-run), highest-weight first:
- Q1 (am I stronger OVERALL, weight 3): the hero is a single-lift carousel, NOT an aggregate
  strength trend. There is no portfolio-level "overall strength" number/line. This is the #1 gap.
- Q5 (volume over time, weight 2): weekly volume is a lone single-week number with no
  week-over-week comparison. Needs a comparative trend/delta.
- Density regression: the recent-workouts session log currently shows a long wall of cards that
  buries the "This Week" summary below it. Summary-first + a collapsed log (2-3 recent) is better.
- Muscle Focus encoding is ambiguous and single-week; PR badges are over-applied.`

const DIAGNOSE_SCHEMA = {
  type: 'object', required: ['worthwhile', 'target', 'currentScore', 'rationale'],
  properties: {
    worthwhile: { type: 'boolean' },
    currentScore: { type: 'number', description: 'closeness to Robinhood north star 0..1 (1=at the bar, higher better)' },
    target: {
      type: 'object', required: ['question', 'problem', 'fixDirection'],
      properties: { question: { type: 'string' }, problem: { type: 'string' }, fixDirection: { type: 'string' } },
    },
    rationale: { type: 'string' },
  },
}
const CAND_SCHEMA = {
  type: 'object', required: ['strategy', 'filesTouched', 'built', 'rendered', 'screenshotTag', 'diff', 'notes'],
  properties: {
    strategy: { type: 'string' }, filesTouched: { type: 'array', items: { type: 'string' } },
    built: { type: 'boolean', description: 'tsc 0 errors AND eslint clean' },
    rendered: { type: 'boolean', description: 'screenshots were produced' },
    screenshotTag: { type: 'string' }, diff: { type: 'string' }, notes: { type: 'string' },
  },
}
const JUDGE_SCHEMA = {
  type: 'object', required: ['verdict', 'magnitude', 'newProblems', 'northStarScore', 'perLensAgg', 'justification'],
  properties: {
    verdict: { type: 'string', enum: ['better', 'same', 'worse'] },
    magnitude: { type: 'string', enum: ['meaningful', 'marginal'] },
    newProblems: { type: 'array', items: { type: 'string' } },
    // UNAMBIGUOUS DIRECTION: 1.0 = fully AT the Robinhood bar (best), 0.0 = far from it.
    // Higher is always better. This is a secondary tiebreak; the pairwise verdict is authoritative.
    northStarScore: { type: 'number', description: 'closeness to the Robinhood north star, 0..1 where 1.0 = at the bar (higher is better)' },
    perLensAgg: { type: 'number', description: 'mean subjective aggregate 1..5 across the rubric dims' },
    justification: { type: 'string' },
  },
}
const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'gatePassed', 'commit', 'notes'],
  properties: { applied: { type: 'boolean' }, gatePassed: { type: 'boolean' }, commit: { type: 'string' }, notes: { type: 'string' } },
}

const ANGLES = [
  'Bold restraint: rebuild the targeted part of the Workouts tab the way Robinhood would — one focal answer, remove everything that does not serve it. You may delete/replace existing widgets. Summary-first.',
  'From scratch: if you were designing this section for the best fitness app on the store, what would it be? Ignore the current layout and build the strongest possible answer to the target question, consistent with the existing theme tokens.',
  'Surgical: the smallest change that meaningfully improves the target question without touching anything else.',
]

// 3-lens vision judge over a set of screenshots. Returns array of lens outputs.
async function judgeLenses(promptCore, phase, tag) {
  const LENSES = [
    ['design-director', 'Judge visual craft, hierarchy, signal-to-noise — strictly in service of usefulness.'],
    ['the-lifter', 'You are a serious gym-goer; for each question actually try to answer it and note the effort. Reward derived answers, penalize raw data you must interpret.'],
    ['the-skeptic', 'Hunt for clutter, redundancy, wasted space, gimmicks, low info-density, and marginal-dressed-as-meaningful. Hard to impress.'],
  ]
  return parallel(LENSES.map(([name, lens]) => () =>
    agent(`You are the ${name.toUpperCase()} lens on a 3-judge visual panel. ${lens}
Read the judge spec: ${SPEC}
${promptCore}`, { schema: JUDGE_SCHEMA, phase, label: `${tag}:${name}` })
  )).then((r) => r.filter(Boolean))
}

phase('Setup')
await agent(`Prepare the shared screenshot dir and render the CURRENT baseline History screen.
cwd: ${REPO}
1. \`mkdir -p ${CAP}\`
2. Render the current screen: \`OUT=${CAP} bash visual-loop/render.sh baseline 5599\`
3. Confirm ${CAP}/baseline-workouts-full.png and ${CAP}/baseline-exercises.png exist (ls -la).
Return "ok" when both screenshots exist, else describe the failure.`, { phase: 'Setup', label: 'setup' })

const ledger = []
let plateau = 0, accepted = 0, curTag = 'baseline'

for (let iter = 1; iter <= MAX && plateau < PLATEAU_STOP; iter++) {
  // ---- Diagnose (judge the current baseline screenshots) ----
  phase(`Iter ${iter} · Diagnose`)
  const lensOuts = await judgeLenses(
    `This is a COLD diagnosis of the CURRENT screen (no candidate). Screenshots:
- Workouts (full tab): ${CAP}/${curTag}-workouts-full.png
- Exercises: ${CAP}/${curTag}-exercises.png
Ignore verdict/magnitude/newProblems (no candidate). Set northStarScore = current closeness to the
Robinhood bar (0..1, 1=at the bar, HIGHER IS BETTER), perLensAgg = your subjective aggregate 1..5, and
in justification name the SINGLE highest-leverage weakness to fix next with a concrete fix direction
citing files. ${KNOWN}`,
    `Iter ${iter} · Diagnose`, `diag${iter}`
  )
  const diag = await agent(
    `Synthesize the 3 judge lenses into the next target for the History Workouts tab.
${SURFACE}
${KNOWN}
Lens justifications:
${lensOuts.map((l, i) => `[lens ${i + 1}] northStarScore=${l.northStarScore} agg=${l.perLensAgg}: ${l.justification}`).join('\n')}
Pick the SINGLE highest-leverage weakness NOT already well-solved. Set worthwhile=false only if the
screen is genuinely at the Robinhood bar (avg northStarScore >= 0.85). Give a concrete fixDirection citing files.`,
    { schema: DIAGNOSE_SCHEMA, phase: `Iter ${iter} · Diagnose`, label: `synth${iter}` }
  )
  const baseScore = lensOuts.reduce((s, l) => s + (l.northStarScore || 0), 0) / (lensOuts.length || 1)
  if (!diag || !diag.worthwhile) { plateau++; ledger.push({ iter, result: 'plateau', baseScore }); log(`Iter ${iter}: at-bar / no worthwhile target (${plateau}/${PLATEAU_STOP}).`); continue }
  log(`Iter ${iter}: target ${diag.target.question} — ${diag.target.problem.slice(0, 90)} (score ${baseScore.toFixed(2)})`)

  // ---- Propose & Render (isolated worktrees, unique ports) ----
  phase(`Iter ${iter} · Propose & Render`)
  const cands = await parallel(
    ANGLES.slice(0, N_CANDIDATES).map((angle, i) => () => {
      const tag = `i${iter}c${i + 1}`
      const port = 5610 + iter * 10 + i
      return agent(
        `Implement candidate #${i + 1} to improve the History screen (Workouts tab).
TARGET question: ${diag.target.question}
PROBLEM: ${diag.target.problem}
FIX DIRECTION: ${diag.target.fixDirection}
YOUR ANGLE: ${angle}
${SURFACE}

You are in an ISOLATED git worktree copy of the repo (cwd). Steps:
1. If ./node_modules missing: \`ln -s ${NM} node_modules\`.
2. Implement a REAL, shippable change matching the existing theme tokens (useTheme colors/fonts) and
   RN style conventions. Be bold if the angle calls for it — you may delete/replace widgets. No placeholders.
   HONESTY OF METRICS: if you introduce an aggregate/composite number, prefer the app's EXISTING
   normalized strength model (percentile / tier / normalized index in lib/data/strengthStandards.ts,
   components/StrengthRadarCard.tsx, components/OverallStrengthModal.tsx) over a raw summed-lbs total.
   A summed est-1RM ("2,537 lbs") is monotonic, always-green, and abstract to a lifter — a vanity metric.
   The number must mean something and be able to go DOWN when the lifter regresses.
3. Build gate MUST pass: \`${GATE}\` (tsc must print 0, then ESLINT_OK). Fix until it does.
4. Render your screenshots into the SHARED dir: \`OUT=${CAP} bash visual-loop/render.sh ${tag} ${port}\`
   Confirm ${CAP}/${tag}-workouts-full.png exists.
5. Return: strategy, filesTouched, built (tsc 0 AND eslint ok), rendered (png exists), screenshotTag="${tag}",
   the full \`git diff HEAD\` as diff, and notes (tradeoffs/risks). Do NOT commit.
If you cannot build or render, return built/rendered=false with the blocker in notes.`,
        { schema: CAND_SCHEMA, isolation: 'worktree', phase: `Iter ${iter} · Propose & Render`, label: `cand:${tag}` }
      )
    })
  )
  const ready = cands.filter((c) => c && c.built && c.rendered && c.diff && c.diff.trim())
  if (!ready.length) { plateau++; ledger.push({ iter, result: 'no-candidate', target: diag.target, baseScore }); log(`Iter ${iter}: no candidate built+rendered (${plateau}/${PLATEAU_STOP}).`); continue }

  // ---- Judge each ready candidate pairwise vs current baseline ----
  phase(`Iter ${iter} · Judge`)
  const judged = []
  for (const c of ready) {
    const lens = await judgeLenses(
      `Compare a CANDIDATE change against the CURRENT screen for the History Workouts tab.
Target being addressed: ${diag.target.question} — ${diag.target.problem}
CURRENT (before): ${CAP}/${curTag}-workouts-full.png  | Exercises: ${CAP}/${curTag}-exercises.png
CANDIDATE (after): ${CAP}/${c.screenshotTag}-workouts-full.png | Exercises: ${CAP}/${c.screenshotTag}-exercises.png
Candidate strategy: ${c.strategy}
Judge PAIRWISE: is the candidate better/same/worse on the target question AND overall? Is the difference
meaningful or marginal? List any NEW problems it introduces (regressions, new clutter, Exercises-tab
damage). Set northStarScore = closeness of the CANDIDATE to the Robinhood bar (0..1, 1=at the bar,
HIGHER IS BETTER — the current screen scored ~${baseScore.toFixed(2)}), perLensAgg = subjective aggregate 1..5.
Be skeptical: a change with only marginal wins or any real regression should NOT read as 'meaningful better'.`,
      `Iter ${iter} · Judge`, c.screenshotTag
    )
    const score = lens.reduce((s, l) => s + (l.northStarScore || 0), 0) / (lens.length || 1)
    const agg = lens.reduce((s, l) => s + (l.perLensAgg || 0), 0) / (lens.length || 1)
    const betters = lens.filter((l) => l.verdict === 'better').length
    const meaningful = lens.filter((l) => l.verdict === 'better' && l.magnitude === 'meaningful').length
    const worse = lens.filter((l) => l.verdict === 'worse').length
    const newProblems = [...new Set(lens.flatMap((l) => l.newProblems || []))]
    judged.push({ ...c, score, agg, betters, meaningful, worse, newProblems, lens })
    log(`  ${c.screenshotTag}: ${betters}/3 better (${meaningful} meaningful), ${worse} worse, score ${score.toFixed(2)}`)
  }

  // ---- Select: the PAIRWISE verdict is authoritative — >=2/3 lenses call it meaningful-better
  // with zero 'worse' votes. northStarScore is only a tiebreak among winners (not a veto), so a
  // direction mismatch in that number can never reject a unanimously-better candidate again. ----
  const eligible = judged.filter((j) => j.meaningful >= 2 && j.worse === 0)
  const winner = eligible.sort((a, b) => b.score - a.score || b.agg - a.agg)[0]
  if (!winner) {
    plateau++
    ledger.push({ iter, result: 'rejected', target: diag.target, baseScore, candidates: judged.map((j) => ({ tag: j.screenshotTag, betters: j.betters, meaningful: j.meaningful, worse: j.worse, score: j.score, newProblems: j.newProblems })) })
    log(`Iter ${iter}: no candidate meaningfully improved without regression (${plateau}/${PLATEAU_STOP}).`)
    continue
  }

  // ---- Apply winner in the main worktree behind the gate, then re-render as new baseline ----
  phase(`Iter ${iter} · Apply`)
  const apply = await agent(
    `Land the winning History improvement into the main worktree at ${REPO} (cwd), verify, commit, re-render.
WINNER strategy: ${winner.strategy}
Files: ${JSON.stringify(winner.filesTouched)}
Judged: ${winner.meaningful}/3 meaningful-better, north-star score ${baseScore.toFixed(2)} -> ${winner.score.toFixed(2)}
Diff:
\`\`\`diff
${(winner.diff || '').slice(0, 16000)}
\`\`\`
Steps:
1. Working tree must be clean (prior iters committed). If not, report applied:false.
2. Apply the change (\`git apply\`; if it doesn't apply cleanly, reconstruct the same end state by editing files).
3. FULL gate must pass: \`${GATE}\` (tsc 0, ESLINT_OK). Also \`node_modules/.bin/jest 2>&1 | tail -3\` must show all suites passing (data correctness floor). If it can't pass, restore clean tree and report applied:false.
4. Re-render the new baseline: \`OUT=${CAP} bash visual-loop/render.sh iter${iter} 5600\`  (confirm iter${iter}-workouts-full.png exists)
5. Commit with message "feat(history): <what> (visual loop iter ${iter})". Do NOT push.
6. Return applied, gatePassed, commit sha (\`git rev-parse --short HEAD\`), notes.`,
    { schema: APPLY_SCHEMA, phase: `Iter ${iter} · Apply`, label: `apply:${iter}` }
  )
  if (apply && apply.applied && apply.gatePassed) {
    accepted++; plateau = 0; curTag = `iter${iter}`
    ledger.push({ iter, result: 'accepted', target: diag.target, commit: apply.commit, score: `${baseScore.toFixed(2)}->${winner.score.toFixed(2)}`, strategy: winner.strategy })
    log(`Iter ${iter}: ✓ accepted ${apply.commit} — score ${baseScore.toFixed(2)}->${winner.score.toFixed(2)} (total ${accepted})`)
  } else {
    plateau++
    ledger.push({ iter, result: 'apply-failed', target: diag.target, notes: apply && apply.notes })
    log(`Iter ${iter}: apply failed (${plateau}/${PLATEAU_STOP}) — ${apply && apply.notes}`)
  }
}

const stop = plateau >= PLATEAU_STOP ? `plateau (${PLATEAU_STOP} non-improving rounds)` : `reached maxIterations ${MAX}`
log(`Visual loop done: ${accepted} improvements accepted. Stopped: ${stop}.`)
return { accepted, iterationsRun: ledger.length, stopReason: stop, finalBaselineTag: curTag, ledger }
