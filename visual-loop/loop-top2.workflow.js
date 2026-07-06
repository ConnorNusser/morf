export const meta = {
  name: 'history-top2-visual-loop',
  description: 'Visual-improvement loop scoped to the FIRST TWO sections of the History Workouts tab (LiftProgressWidget + SessionsFeed): render, judge the top region vs Robinhood, apply the winner, repeat',
  phases: [
    { title: 'Diagnose', detail: 'render current + 3-lens judge of the TOP REGION -> highest-leverage weakness in sections 1-2' },
    { title: 'Propose', detail: 'N candidates edit ONLY the two target components + their lib, gate in isolation, emit a diff' },
    { title: 'Render', detail: 'one agent screenshots each candidate diff in the warm main repo' },
    { title: 'Judge', detail: 'vision judge each candidate pairwise vs current, scoring the top region only' },
    { title: 'Apply', detail: 'land the winner if it meaningfully improves the top region with no regression anywhere' },
  ],
}

const REPO = '/Users/connor/repo/morph'
const NM = '/Users/connor/repo/morph/node_modules'
const CAP = '/private/tmp/claude-501/-Users-connor-repo-morph-worktrees/a215d1fd-38af-4356-8a30-463d97a5feb2/scratchpad/vloop-top2'
const SPEC = `${REPO}/visual-loop/judge-spec.md`
const MAX = (args && args.maxIterations) || 5
const PLATEAU_STOP = (args && args.plateauStop) || 2
const N_CANDIDATES = (args && args.candidates) || 2

const GATE = `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS" ; npx eslint . --ext .ts,.tsx --max-warnings 0 >/dev/null 2>&1 && echo ESLINT_OK || echo ESLINT_FAIL`

// SCOPE: only the FIRST TWO sections of the Workouts tab. Section boundaries in app/(tabs)/history.tsx:
// [1] <LiftProgressWidget> then [2] <SessionsFeed>, ABOVE the Records section.
const SURFACE = `SCOPE — the FIRST TWO sections of the History > Workouts tab, top-down:
  [Section 1] LiftProgressWidget (components/history/LiftProgressWidget.tsx, data lib/history/liftProgress.ts):
    a flat, header-less list — one row per lift, each row a right-aligned run of "weight×reps" points
    with a tiny month label, one point per month. It is the very FIRST thing the eye hits on the tab.
  [Section 2] SessionsFeed (components/history/SessionsFeed.tsx, data lib/history/sessionRecap.ts):
    the reflective centerpiece — the latest session as a cinematic hero (emblem + eyebrow date, big
    narrative headline, a large standout-set stat, a volume-vs-last delta pill, and a Volume/Sets/Time
    footer), followed by compact past-session "moment" rows and a "View all" toggle.
You may edit ONLY those two components and their pure data libs (lib/history/liftProgress.ts,
lib/history/sessionRecap.ts, and helpers they already import). You MAY change how history.tsx WIRES these
two (props passed), but you must NOT add new sections, and must NOT touch Records / TopMovers /
WeeklyOverview / MuscleBalanceCard / MonthlyTrends or the Exercises tab. Keep the section ORDER.`

const KNOWN = `Known standing weaknesses of the TOP TWO sections (highest-weight first):
- Focal hierarchy inversion (weight 3): the tab OPENS on LiftProgressWidget — a dense, header-less grid
  of tiny "185×6  195×6  205×6" numbers. The boldest, most-understood element (the SessionsFeed hero)
  sits BELOW it. Robinhood leads with the hero answer; here the eye hits a wall of small raw numbers
  first. Either the hero should lead, or section 1 must become instantly glanceable.
- Section 1 is raw, not derived (weight 3, Q2 per-lift progression): LiftProgressWidget dumps the actual
  numbers per month and makes YOU compute the trend. No sparkline, no direction color, no delta, no
  header saying what it is. The Exercises tab already nails per-lift (est-1RM + green delta + sparkline)
  — section 1 should answer "is this lift trending up?" preattentively, not with arithmetic.
- Redundancy risk: section 1 (per-lift over months) and the SessionsFeed hero can feel like two answers
  to overlapping questions stacked with no connective hierarchy. One focal answer, then support.
- Density: with 8 lifts the header-less grid can be a tall, monotone block before you reach any narrative.`

const DIAGNOSE_SCHEMA = {
  type: 'object', required: ['worthwhile', 'target', 'currentScore', 'rationale'],
  properties: {
    worthwhile: { type: 'boolean' },
    currentScore: { type: 'number', description: 'closeness of the TOP REGION to the Robinhood north star 0..1 (1=at the bar, higher better)' },
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
  properties: { rendered: { type: 'array', items: { type: 'string' } }, failed: { type: 'array', items: { type: 'string' } }, notes: { type: 'string' } },
}
const JUDGE_SCHEMA = {
  type: 'object', required: ['verdict', 'magnitude', 'newProblems', 'northStarScore', 'perLensAgg', 'justification'],
  properties: {
    verdict: { type: 'string', enum: ['better', 'same', 'worse'] },
    magnitude: { type: 'string', enum: ['meaningful', 'marginal'] },
    newProblems: { type: 'array', items: { type: 'string' } },
    northStarScore: { type: 'number', description: 'closeness of the TOP REGION to the Robinhood north star, 0..1 (1=at the bar, higher is better)' },
    perLensAgg: { type: 'number', description: 'mean subjective aggregate 1..5' },
    justification: { type: 'string' },
  },
}
const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'gatePassed', 'commit', 'notes'],
  properties: { applied: { type: 'boolean' }, gatePassed: { type: 'boolean' }, commit: { type: 'string' }, notes: { type: 'string' } },
}

// The judges look at the FULL-tab screenshot but score ONLY the top region (sections 1-2, roughly
// everything above the "Records" heading). Everything below is a no-regression constraint only.
const REGION = `IMPORTANT — you are shown the FULL Workouts tab, but you are judging ONLY the TOP REGION:
everything from the top of the tab down to (but not including) the "Records" heading — i.e. the
LiftProgressWidget grid + the SessionsFeed hero and its first moment rows. Score understanding-per-glance
for THAT region only. Content below "Records" is OUT OF SCOPE for scoring; only flag it under newProblems
if the candidate visibly damaged it.`

const ANGLES = [
  'Reorder + elevate: make the SessionsFeed hero the first focal answer and turn LiftProgressWidget into a glanceable, derived trend strip (sparkline / direction color / delta) that supports it. You may re-wire the order of these two in history.tsx. Summary-first, one clear hero.',
  'From scratch: if the best fitness app on the store designed the TOP of a history tab, what would sections 1-2 be? Build the strongest possible glanceable answer to "am I progressing, and how did my last session go?" using existing theme tokens — you may rewrite LiftProgressWidget and/or the SessionsFeed hero, but keep them as two coherent sections.',
  'Surgical: the smallest change that makes LiftProgressWidget answer "trending up?" at a glance (add a sparkline/delta/header) without touching SessionsFeed or anything below.',
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
${REGION}
${promptCore}`, { schema: JUDGE_SCHEMA, phase, label: `${tag}:${name}` })
  )).then((r) => r.filter(Boolean))
}

phase('Setup')
await agent(`Prepare the screenshot dir and render the CURRENT baseline History screen (this also WARMS
the Metro cache so later candidate renders are fast). cwd: ${REPO}
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
    `COLD diagnosis of the CURRENT screen's TOP REGION (no candidate). Screenshot (full tab, judge the top):
- Workouts (full tab): ${CAP}/${curTag}-workouts-full.png
Ignore verdict/magnitude/newProblems. Set northStarScore = current closeness of the TOP REGION to the
Robinhood bar (0..1, 1=at the bar, HIGHER IS BETTER), perLensAgg = subjective aggregate 1..5, and in
justification name the SINGLE highest-leverage weakness to fix next in sections 1-2 with a concrete fix
direction citing files. ${KNOWN}`,
    `Iter ${iter} · Diagnose`, `diag${iter}`
  )
  const diag = await agent(
    `Synthesize the 3 judge lenses into the next target for the TOP TWO sections of the History Workouts tab.
${SURFACE}
${KNOWN}
Lens justifications:
${lensOuts.map((l, i) => `[lens ${i + 1}] northStarScore=${l.northStarScore} agg=${l.perLensAgg}: ${l.justification}`).join('\n')}
Pick the SINGLE highest-leverage weakness in sections 1-2 NOT already well-solved. worthwhile=false only if
the top region is genuinely at the Robinhood bar (avg northStarScore >= 0.85). Give a concrete fixDirection
citing files, staying strictly within the two target components + their libs.`,
    { schema: DIAGNOSE_SCHEMA, phase: `Iter ${iter} · Diagnose`, label: `synth${iter}` }
  )
  const baseScore = lensOuts.reduce((s, l) => s + (l.northStarScore || 0), 0) / (lensOuts.length || 1)
  if (!diag || !diag.worthwhile) { plateau++; ledger.push({ iter, result: 'plateau', baseScore }); log(`Iter ${iter}: top region at-bar / no worthwhile target (${plateau}/${PLATEAU_STOP}).`); continue }
  log(`Iter ${iter}: target ${diag.target.question} — ${diag.target.problem.slice(0, 90)} (score ${baseScore.toFixed(2)})`)

  // ---- Propose (parallel worktrees; emit a diff, NO render) ----
  phase(`Iter ${iter} · Propose`)
  const cands = await parallel(
    ANGLES.slice(0, N_CANDIDATES).map((angle, i) => () => {
      const tag = `i${iter}c${i + 1}`
      return agent(
        `Implement candidate #${i + 1} to improve the TOP TWO sections of the History Workouts tab.
TARGET question: ${diag.target.question}
PROBLEM: ${diag.target.problem}
FIX DIRECTION: ${diag.target.fixDirection}
YOUR ANGLE: ${angle}
${SURFACE}

You are in an ISOLATED git worktree copy (cwd). Steps:
1. If ./node_modules missing: \`ln -s ${NM} node_modules\`.
2. Implement a REAL, shippable change matching existing theme tokens (useTheme colors/fonts) and RN
   conventions. Stay strictly within the SCOPE above — edit ONLY the two target components + their pure
   data libs, and at most re-wire how history.tsx passes props / orders those two sections. Do NOT add new
   sections and do NOT touch anything below the Records heading or the Exercises tab. No placeholders.
   HONESTY OF METRICS: any derived number/sparkline must reflect real data from the existing history model
   and be able to go DOWN when the lifter regresses — no vanity always-green totals.
3. Build gate MUST pass: \`${GATE}\` (tsc prints 0, then ESLINT_OK). Fix until it does.
4. Write your full diff to a shared file: \`git diff HEAD > ${CAP}/${tag}.diff\` and confirm it is non-empty.
   Do NOT render or screenshot. Do NOT commit.
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
      `Compare a CANDIDATE change against the CURRENT screen, judging ONLY the TOP REGION (sections 1-2).
Target addressed: ${diag.target.question} — ${diag.target.problem}
CURRENT (before), full tab: ${CAP}/${curTag}-workouts-full.png
CANDIDATE (after), full tab: ${CAP}/${c.tag}-workouts-full.png
Candidate strategy: ${c.strategy}
Judge PAIRWISE on the TOP REGION: better/same/worse on the target AND on the region overall? meaningful or
marginal? List any NEW problems it introduces (new clutter in the top region, dishonest metrics, OR visible
damage to sections below Records / the Exercises tab). Set northStarScore = closeness of the CANDIDATE's TOP
REGION to the Robinhood bar (0..1, current top region scored ~${baseScore.toFixed(2)}), perLensAgg = 1..5.
Be skeptical: marginal wins or any real regression must NOT read as 'meaningful better'.`,
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

  // ---- Select: >=2/3 meaningful-better, 0 worse ----
  const eligible = judged.filter((j) => j.meaningful >= 2 && j.worse === 0)
  const winner = eligible.sort((a, b) => b.score - a.score || b.agg - a.agg)[0]
  if (!winner) {
    plateau++
    ledger.push({ iter, result: 'rejected', target: diag.target, baseScore, candidates: judged.map((j) => ({ tag: j.tag, betters: j.betters, meaningful: j.meaningful, worse: j.worse, score: j.score, newProblems: j.newProblems })) })
    log(`Iter ${iter}: no candidate meaningfully improved the top region without regression (${plateau}/${PLATEAU_STOP}).`)
    continue
  }

  // ---- Apply winner in main repo behind the gate. Its screenshots ARE the new baseline. ----
  phase(`Iter ${iter} · Apply`)
  const apply = await agent(
    `Land the winning top-region improvement into the main worktree at ${REPO} (cwd), verify, commit.
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
4. Commit: "feat(history): <what> (top-2 visual loop iter ${iter})". Do NOT push. Do NOT re-render.
5. Return applied, gatePassed, commit sha (\`git rev-parse --short HEAD\`), notes.`,
    { schema: APPLY_SCHEMA, phase: `Iter ${iter} · Apply`, label: `apply:${iter}` }
  )
  if (apply && apply.applied && apply.gatePassed) {
    accepted++; plateau = 0; curTag = winner.tag
    ledger.push({ iter, result: 'accepted', target: diag.target, commit: apply.commit, score: `${baseScore.toFixed(2)}->${winner.score.toFixed(2)}`, strategy: winner.strategy })
    log(`Iter ${iter}: ✓ accepted ${apply.commit} — score ${baseScore.toFixed(2)}->${winner.score.toFixed(2)} (total ${accepted})`)
  } else {
    plateau++
    ledger.push({ iter, result: 'apply-failed', target: diag.target, notes: apply && apply.notes })
    log(`Iter ${iter}: apply failed (${plateau}/${PLATEAU_STOP}) — ${apply && apply.notes}`)
  }
}

const stop = plateau >= PLATEAU_STOP ? `plateau (${PLATEAU_STOP} non-improving rounds)` : `reached maxIterations ${MAX}`
log(`Top-2 visual loop done: ${accepted} improvements accepted. Stopped: ${stop}.`)
return { accepted, iterationsRun: ledger.length, stopReason: stop, finalBaselineTag: curTag, ledger }
