export const meta = {
  name: 'history-visual-loop',
  description: 'Autonomous visual-improvement loop for the History screen: render real screenshots, judge understanding-per-glance vs Robinhood, apply the winner, repeat',
  phases: [
    { title: 'Diagnose', detail: 'render current + 3-lens judge -> the highest-leverage weakness' },
    { title: 'Propose', detail: 'N candidates edit + gate in isolation, emit a diff (no render)' },
    { title: 'Render', detail: 'one agent screenshots each candidate diff in the warm main repo (~8s each)' },
    { title: 'Judge', detail: 'vision judge each candidate pairwise vs current (meaningful vs marginal)' },
    { title: 'Apply', detail: 'land the winner if it meaningfully improves with no regression' },
  ],
}

const REPO = '/Users/connor/repo/morph'
const NM = '/Users/connor/repo/morph/node_modules'
const CAP = '/private/tmp/claude-501/-Users-connor-repo-morph-worktrees/e1764d36-4153-4339-b61b-f3d1b1d39411/scratchpad/vloop'
const SPEC = `${REPO}/visual-loop/judge-spec.md`
const MAX = (args && args.maxIterations) || 12
const PLATEAU_STOP = (args && args.plateauStop) || 3
const N_CANDIDATES = (args && args.candidates) || 2

const GATE = `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS" ; npx eslint . --ext .ts,.tsx --max-warnings 0 >/dev/null 2>&1 && echo ESLINT_OK || echo ESLINT_FAIL`

const SURFACE = `The History screen: app/(tabs)/history.tsx (two tabs, Workouts + Exercises) and
components/history/* (HistoryHero, WeeklyOverview, WorkoutCard, ExerciseCard, MuscleFocusChips,
WorkoutDetailModal, ExerciseHistoryModal) plus lib/history/*. The Exercises tab is already
near the Robinhood bar (per-lift est-1RM + green delta + sparkline) — DO NOT regress it. The
Workouts tab is the target.`

const KNOWN = `Known standing weaknesses (from prior judging), highest-weight first:
- Q1 (am I stronger OVERALL, weight 3): the hero is a single-lift carousel, NOT an aggregate
  strength trend. No portfolio-level "overall strength" answer. This is the #1 gap.
- Q5 (volume over time, weight 2): weekly volume is a lone single-week number with no
  week-over-week comparison. Needs a comparative trend/delta.
- Density: the recent-workouts session log can run long and bury the "This Week" summary.
  Summary-first + a collapsed log (2-3 recent) with "View all" is better.
- Muscle Focus encoding is ambiguous / single-week; PR badges are over-applied.`

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
  type: 'object', required: ['strategy', 'filesTouched', 'built', 'diffPath', 'notes'],
  properties: {
    strategy: { type: 'string' }, filesTouched: { type: 'array', items: { type: 'string' } },
    built: { type: 'boolean', description: 'tsc 0 errors AND eslint clean' },
    diffPath: { type: 'string', description: 'path where the full git diff was written' },
    notes: { type: 'string' },
  },
}
const RENDER_SCHEMA = {
  type: 'object', required: ['rendered'],
  properties: { rendered: { type: 'array', items: { type: 'string' }, description: 'tags that produced screenshots' }, failed: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } },
}
const JUDGE_SCHEMA = {
  type: 'object', required: ['verdict', 'magnitude', 'newProblems', 'northStarScore', 'perLensAgg', 'justification'],
  properties: {
    verdict: { type: 'string', enum: ['better', 'same', 'worse'] },
    magnitude: { type: 'string', enum: ['meaningful', 'marginal'] },
    newProblems: { type: 'array', items: { type: 'string' } },
    northStarScore: { type: 'number', description: 'closeness to the Robinhood north star, 0..1 where 1.0 = at the bar (higher is better)' },
    perLensAgg: { type: 'number', description: 'mean subjective aggregate 1..5' },
    justification: { type: 'string' },
  },
}
const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'gatePassed', 'commit', 'notes'],
  properties: { applied: { type: 'boolean' }, gatePassed: { type: 'boolean' }, commit: { type: 'string' }, notes: { type: 'string' } },
}

const ANGLES = [
  'Bold restraint: rebuild the targeted part of the Workouts tab the way Robinhood would — one focal answer, remove everything that does not serve it. You may delete/replace widgets. Summary-first.',
  'From scratch: if you were designing this section for the best fitness app on the store, what would it be? Ignore the current layout and build the strongest possible answer to the target question, consistent with the existing theme tokens.',
  'Surgical: the smallest change that meaningfully improves the target question without touching anything else.',
]

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
await agent(`Prepare the screenshot dir and render the CURRENT baseline History screen (this also WARMS
the Metro cache so later candidate renders are ~8s instead of ~30s). cwd: ${REPO}
1. \`mkdir -p ${CAP}\`
2. \`OUT=${CAP} bash visual-loop/render.sh baseline 5599\`
3. Confirm ${CAP}/baseline-workouts-full.png and ${CAP}/baseline-exercises.png exist (ls -la).
Return "ok" when both exist, else describe the failure.`, { phase: 'Setup', label: 'setup' })

const ledger = []
let plateau = 0, accepted = 0, curTag = 'baseline'

for (let iter = 1; iter <= MAX && plateau < PLATEAU_STOP; iter++) {
  // ---- Diagnose ----
  phase(`Iter ${iter} · Diagnose`)
  const lensOuts = await judgeLenses(
    `COLD diagnosis of the CURRENT screen (no candidate). Screenshots:
- Workouts (full tab): ${CAP}/${curTag}-workouts-full.png
- Exercises: ${CAP}/${curTag}-exercises.png
Ignore verdict/magnitude/newProblems. Set northStarScore = current closeness to the Robinhood bar
(0..1, 1=at the bar, HIGHER IS BETTER), perLensAgg = subjective aggregate 1..5, and in justification
name the SINGLE highest-leverage weakness to fix next with a concrete fix direction citing files. ${KNOWN}`,
    `Iter ${iter} · Diagnose`, `diag${iter}`
  )
  const diag = await agent(
    `Synthesize the 3 judge lenses into the next target for the History Workouts tab.
${SURFACE}
${KNOWN}
Lens justifications:
${lensOuts.map((l, i) => `[lens ${i + 1}] northStarScore=${l.northStarScore} agg=${l.perLensAgg}: ${l.justification}`).join('\n')}
Pick the SINGLE highest-leverage weakness NOT already well-solved. worthwhile=false only if the screen
is genuinely at the Robinhood bar (avg northStarScore >= 0.85). Give a concrete fixDirection citing files.`,
    { schema: DIAGNOSE_SCHEMA, phase: `Iter ${iter} · Diagnose`, label: `synth${iter}` }
  )
  const baseScore = lensOuts.reduce((s, l) => s + (l.northStarScore || 0), 0) / (lensOuts.length || 1)
  if (!diag || !diag.worthwhile) { plateau++; ledger.push({ iter, result: 'plateau', baseScore }); log(`Iter ${iter}: at-bar / no worthwhile target (${plateau}/${PLATEAU_STOP}).`); continue }
  log(`Iter ${iter}: target ${diag.target.question} — ${diag.target.problem.slice(0, 90)} (score ${baseScore.toFixed(2)})`)

  // ---- Propose (parallel worktrees; emit a diff, NO render) ----
  phase(`Iter ${iter} · Propose`)
  const cands = await parallel(
    ANGLES.slice(0, N_CANDIDATES).map((angle, i) => () => {
      const tag = `i${iter}c${i + 1}`
      return agent(
        `Implement candidate #${i + 1} to improve the History screen (Workouts tab).
TARGET question: ${diag.target.question}
PROBLEM: ${diag.target.problem}
FIX DIRECTION: ${diag.target.fixDirection}
YOUR ANGLE: ${angle}
${SURFACE}

You are in an ISOLATED git worktree copy (cwd). Steps:
1. If ./node_modules missing: \`ln -s ${NM} node_modules\`.
2. Implement a REAL, shippable change matching existing theme tokens (useTheme colors/fonts) and RN
   conventions. Be bold if the angle calls for it — you may delete/replace widgets. No placeholders.
   HONESTY OF METRICS: if you introduce an aggregate/composite number, prefer the app's EXISTING
   normalized strength model (percentile / tier / normalized index in lib/data/strengthStandards.ts,
   components/StrengthRadarCard.tsx, components/OverallStrengthModal.tsx) over a raw summed-lbs total.
   A summed est-1RM ("2,537 lbs") is monotonic, always-green, and abstract — a vanity metric. The
   number must MEAN something and be able to go DOWN when the lifter regresses.
3. Build gate MUST pass: \`${GATE}\` (tsc prints 0, then ESLINT_OK). Fix until it does.
4. Write your full diff to a shared file: \`git diff HEAD > ${CAP}/${tag}.diff\` and confirm it is non-empty.
   Do NOT render or screenshot (that happens later in the warm main repo). Do NOT commit.
5. Return: strategy, filesTouched, built (tsc 0 AND eslint ok), diffPath="${CAP}/${tag}.diff", notes.
If you cannot build, return built=false with the blocker in notes.`,
        { schema: CAND_SCHEMA, isolation: 'worktree', phase: `Iter ${iter} · Propose`, label: `cand:${tag}` }
      ).then((r) => (r ? { ...r, tag } : r))
    })
  )
  const built = cands.filter((c) => c && c.built && c.diffPath)
  if (!built.length) { plateau++; ledger.push({ iter, result: 'no-candidate', target: diag.target, baseScore }); log(`Iter ${iter}: no candidate built (${plateau}/${PLATEAU_STOP}).`); continue }

  // ---- Render (ONE agent, SEQUENTIAL, in the warm main repo) ----
  phase(`Iter ${iter} · Render`)
  const rr = await agent(
    `Render each candidate diff into a screenshot, in the MAIN repo at ${REPO} (cwd). The working tree is
at the committed baseline and MUST be clean. Do these ONE AT A TIME (the helper mutates then reverts the
tree — never overlap them):
${built.map((c, k) => `- tag ${c.tag}: diff at ${c.diffPath}, port ${5600 + iter * 5 + k}`).join('\n')}
For each: \`OUT=${CAP} bash visual-loop/render-candidate.sh <diffPath> <tag> <port>\` and confirm
${CAP}/<tag>-workouts-full.png was produced. The helper reverses the patch itself; still, after each,
verify \`git status\` is clean before the next. Return rendered=[tags that produced a full-page png],
failed=[tags that didn't], notes.`,
    { schema: RENDER_SCHEMA, phase: `Iter ${iter} · Render`, label: `render:${iter}` }
  )
  const ready = built.filter((c) => rr && (rr.rendered || []).includes(c.tag))
  if (!ready.length) { plateau++; ledger.push({ iter, result: 'no-render', target: diag.target, baseScore, notes: rr && rr.notes }); log(`Iter ${iter}: no candidate rendered (${plateau}/${PLATEAU_STOP}).`); continue }

  // ---- Judge each rendered candidate pairwise vs current ----
  phase(`Iter ${iter} · Judge`)
  const judged = []
  for (const c of ready) {
    const lens = await judgeLenses(
      `Compare a CANDIDATE change against the CURRENT screen for the History Workouts tab.
Target addressed: ${diag.target.question} — ${diag.target.problem}
CURRENT (before): ${CAP}/${curTag}-workouts-full.png | Exercises: ${CAP}/${curTag}-exercises.png
CANDIDATE (after): ${CAP}/${c.tag}-workouts-full.png | Exercises: ${CAP}/${c.tag}-exercises.png
Candidate strategy: ${c.strategy}
Judge PAIRWISE: better/same/worse on the target AND overall? meaningful or marginal? List any NEW
problems it introduces (regressions, new clutter, Exercises-tab damage). Set northStarScore = closeness
of the CANDIDATE to the Robinhood bar (0..1, 1=at the bar, HIGHER IS BETTER — the current screen scored
~${baseScore.toFixed(2)}), perLensAgg = subjective aggregate 1..5. Be skeptical: marginal wins or any
real regression must NOT read as 'meaningful better'.`,
      `Iter ${iter} · Judge`, c.tag
    )
    const score = lens.reduce((s, l) => s + (l.northStarScore || 0), 0) / (lens.length || 1)
    const agg = lens.reduce((s, l) => s + (l.perLensAgg || 0), 0) / (lens.length || 1)
    const betters = lens.filter((l) => l.verdict === 'better').length
    const meaningful = lens.filter((l) => l.verdict === 'better' && l.magnitude === 'meaningful').length
    const worse = lens.filter((l) => l.verdict === 'worse').length
    const newProblems = [...new Set(lens.flatMap((l) => l.newProblems || []))]
    judged.push({ ...c, score, agg, betters, meaningful, worse, newProblems })
    log(`  ${c.tag}: ${betters}/3 better (${meaningful} meaningful), ${worse} worse, score ${score.toFixed(2)}`)
  }

  // ---- Select: pairwise verdict is authoritative (>=2/3 meaningful-better, 0 worse). ----
  const eligible = judged.filter((j) => j.meaningful >= 2 && j.worse === 0)
  const winner = eligible.sort((a, b) => b.score - a.score || b.agg - a.agg)[0]
  if (!winner) {
    plateau++
    ledger.push({ iter, result: 'rejected', target: diag.target, baseScore, candidates: judged.map((j) => ({ tag: j.tag, betters: j.betters, meaningful: j.meaningful, worse: j.worse, score: j.score, newProblems: j.newProblems })) })
    log(`Iter ${iter}: no candidate meaningfully improved without regression (${plateau}/${PLATEAU_STOP}).`)
    continue
  }

  // ---- Apply winner in main repo behind the gate. Its screenshots ARE the new baseline (no re-render). ----
  phase(`Iter ${iter} · Apply`)
  const apply = await agent(
    `Land the winning History improvement into the main worktree at ${REPO} (cwd), verify, commit.
WINNER strategy: ${winner.strategy}
Files: ${JSON.stringify(winner.filesTouched)}
Judged: ${winner.meaningful}/3 meaningful-better, north-star ${baseScore.toFixed(2)} -> ${winner.score.toFixed(2)}
Its diff is at ${winner.diffPath}.
Steps:
1. Working tree must be clean at the committed baseline. If not, report applied:false.
2. Apply the diff: \`git apply ${winner.diffPath}\` (if it doesn't apply cleanly, reconstruct the same
   end state by editing files to match the diff).
3. FULL gate must pass: \`${GATE}\` (tsc 0, ESLINT_OK) AND \`node_modules/.bin/jest 2>&1 | tail -3\`
   shows all suites passing (data-correctness floor). If it can't pass, restore a clean tree and report
   applied:false.
4. Commit: "feat(history): <what> (visual loop iter ${iter})". Do NOT push. Do NOT re-render.
5. Return applied, gatePassed, commit sha (\`git rev-parse --short HEAD\`), notes.`,
    { schema: APPLY_SCHEMA, phase: `Iter ${iter} · Apply`, label: `apply:${iter}` }
  )
  if (apply && apply.applied && apply.gatePassed) {
    accepted++; plateau = 0; curTag = winner.tag // winner's screenshots become the new baseline
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
