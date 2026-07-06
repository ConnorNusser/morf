export const meta = {
  name: 'history-top2-career-loop',
  description: 'Visual loop for the top two History sections (LiftProgressWidget + SessionsFeed), judged against the Career/profile section as the visual bar: intrigue, consistency, visual appeal, tasteful gamification',
  phases: [
    { title: 'Setup', detail: 'render baseline History + the Career section reference shot' },
    { title: 'Diagnose', detail: '3-lens judge of the top region vs the Career bar -> highest-leverage weakness' },
    { title: 'Propose', detail: 'N candidates edit ONLY the two target components + their libs, gate in isolation, emit a diff' },
    { title: 'Render', detail: 'one agent screenshots each candidate diff in the warm main repo' },
    { title: 'Judge', detail: 'vision judge each candidate pairwise vs current, against the Career reference' },
    { title: 'Apply', detail: 'land the winner if it meaningfully improves with no regression' },
  ],
}

const REPO = '/Users/connor/repo/morph'
const NM = '/Users/connor/repo/morph/node_modules'
const CAP = '/private/tmp/claude-501/-Users-connor-repo-morph-worktrees/a215d1fd-38af-4356-8a30-463d97a5feb2/scratchpad/vloop-career'
const MAX = (args && args.maxIterations) || 5
const PLATEAU_STOP = (args && args.plateauStop) || 2
const N_CANDIDATES = (args && args.candidates) || 2

const GATE = `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS" ; npx eslint . --ext .ts,.tsx --max-warnings 0 >/dev/null 2>&1 && echo ESLINT_OK || echo ESLINT_FAIL`

const SURFACE = `SCOPE — the FIRST TWO sections of the History > Workouts tab, top-down:
  [Section 1] LiftProgressWidget (components/history/LiftProgressWidget.tsx, data lib/history/liftProgress.ts):
    per-lift rows of month-over-month best-set chips; the latest month is an accent-filled capsule,
    earlier months are outlined chips colored green/red by rise/fall.
  [Section 2] SessionsFeed (components/history/SessionsFeed.tsx, data lib/history/sessionRecap.ts,
    lib/history/milestones.ts, lib/history/sessionIdentity.ts):
    the latest session as a cinematic hero (PPL emblem + eyebrow date, narrative headline, big standout
    set, Volume/Sets/Time footer with the volume delta attached), then compact past-session moment rows.
You may edit ONLY those two components and their pure data libs, plus reusing EXISTING shared primitives
(AnimatedBar, AnimatedCount, TierBadge, FlipCard, MiniSparkline, Card, PPL_COLORS, strengthStandards tier
colors, lib/gamification/*). You MAY change how app/(tabs)/history.tsx wires these two (props/order), but
you must NOT add new sections and NOT touch Records / TopMovers / WeeklyOverview / MuscleBalanceCard /
MonthlyTrends or the Exercises tab.`

// The new reward function: the Career section IS the bar.
const NORTHSTAR = `NORTH STAR — the app's own Career section (components/profile/CareerSection.tsx, reference
screenshot provided). It is the internal quality bar the owner already loves. What makes it great:
- INTRIGUE: layered, poke-able surfaces — FlipCards that flip to reveal rarity breakdowns, a PPL-colored
  training heatmap, animated counts and filling bars. You want to touch it and come back to it.
- GAMIFICATION (serious, earned): strength tier + percentile hero with a progress bar "X to Gold",
  a NEXT goal with progress track, achievements N/M with rarity tiers. Motivation mechanics for an adult
  lifter — no childish badges, nothing dishonest, every number derived from real training data.
- CONSISTENCY: one design language — uppercase micro-labels (ACTIVITY, NEXT, ACHIEVEMENTS), hairline
  dividers, tier colors from strengthStandards, PPL split colors, compact stat rows, elevated Card.
- VISUAL APPEAL: dense but calm; color always MEANS something (tier, split, rarity, heat).
The goal of this loop: bring the top two History sections up to that bar — continually improving
INTRIGUE, CONSISTENCY (with the Career design language and with each other), VISUAL APPEAL, and
tasteful GAMIFICATION. NOTE: the judge-spec's old anti-gamification guard is OVERRIDDEN for this run —
gamification that serves motivation (tiers, progress-to-next, streak pull, milestone proximity, PR
celebration) is now a GOAL. Still penalized: childish/kitsch treatment, dishonest always-up metrics,
decoration that means nothing, clutter that buries the data.`

const KNOWN = `Known standing gaps of the top two sections vs the Career bar:
- No gamified layer at all: no tier colors, no progress-to-next-milestone, no streak/PR pull. The chips
  and feed state facts; Career makes facts feel like a game you're winning. (SessionsFeed already has an
  optional milestone banner prop that history.tsx never passes — lib/history/milestones.ts exists.)
- Weak intrigue: everything is visible at once; nothing invites a tap/flip/press the way Career's
  FlipCards do. No animated count/bar anywhere in the top region.
- Consistency drift: Section 1 (chips) and Section 2 (flat cinematic feed) don't share one language, and
  neither uses Career's uppercase micro-label headers — Section 1 has NO header at all, so it reads as an
  unlabeled wall. PPL colors appear on session emblems but nowhere in Section 1; tier colors nowhere.
- The hero's emblem + purple eyebrow is the only strong color moment; the rest of the region is monochrome
  + green/red. Career shows how to use meaningful color richly without noise.`

const DIAGNOSE_SCHEMA = {
  type: 'object', required: ['worthwhile', 'target', 'currentScore', 'rationale'],
  properties: {
    worthwhile: { type: 'boolean' },
    currentScore: { type: 'number', description: 'closeness of the top region to the Career bar 0..1 (1=at the bar)' },
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
    built: { type: 'boolean' }, diffPath: { type: 'string' }, notes: { type: 'string' },
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
    northStarScore: { type: 'number', description: 'closeness of the top region to the Career bar, 0..1 (higher is better)' },
    perLensAgg: { type: 'number', description: 'mean subjective aggregate 1..5' },
    justification: { type: 'string' },
  },
}
const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'gatePassed', 'commit', 'notes'],
  properties: { applied: { type: 'boolean' }, gatePassed: { type: 'boolean' }, commit: { type: 'string' }, notes: { type: 'string' } },
}

const REGION = `You are shown the FULL Workouts tab; judge ONLY the TOP REGION: everything above the
"Records" heading (the per-lift chip rows + the session hero and its first moment rows). Content below
Records is out of scope — only flag it under newProblems if the candidate visibly damaged it. Screenshots
are STATIC: animation primitives (AnimatedCount/AnimatedBar/FlipCard) can't be seen moving — judge the
composition, and treat documented use of those primitives (stated in the candidate strategy) as a plus
when the static frame also stands on its own.`

const ANGLES = [
  'Career-language port: bring the Career section\'s design system into the top region — uppercase micro-label headers, tier/PPL color coding, progress-to-next bars, an AnimatedCount hero number. Make the two sections read as siblings of the Career card.',
  'Gamified pull: add the motivation layer — milestone proximity (SessionsFeed already accepts a milestone prop; lib/history/milestones.ts exists), streak/PR celebration done adult, progress bars toward the next tier or record. Every mechanic must derive from real data and be able to read "not yet" honestly.',
  'Intrigue pass: make the region poke-able and layered like Career — a FlipCard back-face with the deeper stat, a tappable chip revealing detail, one strong animated moment. Smallest set of changes that makes you want to touch the screen.',
]

async function judgeLenses(promptCore, phase, tag) {
  const LENSES = [
    ['design-director', 'Judge visual craft, hierarchy and CONSISTENCY — does the top region speak the Career card\'s design language (micro-labels, meaningful color, dense-but-calm), and do the two sections speak it to each other?'],
    ['the-lifter', 'You are a serious gym-goer. Judge INTRIGUE and MOTIVATION: does this region make you want to poke it, and does it make you want to train again to move a number? Reward earned gamification (tiers, next-milestone pull, honest streaks); ignore mechanics that feel bolted on.'],
    ['the-skeptic', 'Guard against kitsch: childish badges, dishonest always-green metrics, decoration without meaning, clutter that buries data, gimmick flips that hide what should be visible. Gamification is welcome ONLY when it is earned, honest, and adult. Hard to impress.'],
  ]
  return parallel(LENSES.map(([name, lens]) => () =>
    agent(`You are the ${name.toUpperCase()} lens on a 3-judge visual panel. ${lens}
${NORTHSTAR}
${REGION}
${promptCore}`, { schema: JUDGE_SCHEMA, phase, label: `${tag}:${name}` })
  )).then((r) => r.filter(Boolean))
}

phase('Setup')
await agent(`Prepare the screenshot dir, render the CURRENT baseline History screen AND the Career-section
reference shot (PROFILE=1 makes capture.js also shoot the Profile tab). cwd: ${REPO}
1. \`mkdir -p ${CAP}\`
2. \`PROFILE=1 OUT=${CAP} bash visual-loop/render.sh baseline 5610\`
3. Confirm ${CAP}/baseline-workouts-full.png AND ${CAP}/baseline-profile-full.png exist (ls -la).
Return "ok" when both exist, else describe the failure.`, { phase: 'Setup', label: 'setup' })

const CAREER_REF = `${CAP}/baseline-profile-full.png`
const ledger = []
let plateau = 0, accepted = 0, curTag = 'baseline'

for (let iter = 1; iter <= MAX && plateau < PLATEAU_STOP; iter++) {
  // ---- Diagnose ----
  phase(`Iter ${iter} · Diagnose`)
  const lensOuts = await judgeLenses(
    `COLD diagnosis of the CURRENT top region (no candidate).
- Current Workouts tab (full): ${CAP}/${curTag}-workouts-full.png
- CAREER REFERENCE (the bar): ${CAREER_REF} — the Career card is on this Profile screenshot.
Ignore verdict/magnitude/newProblems. Set northStarScore = closeness of the top region to the Career bar
(0..1), perLensAgg = 1..5, and in justification name the SINGLE highest-leverage weakness to fix next
(intrigue / consistency / appeal / gamification) with a concrete fix direction citing files. ${KNOWN}`,
    `Iter ${iter} · Diagnose`, `diag${iter}`
  )
  const diag = await agent(
    `Synthesize the 3 judge lenses into the next target for the top two History sections.
${SURFACE}
${NORTHSTAR}
${KNOWN}
Lens justifications:
${lensOuts.map((l, i) => `[lens ${i + 1}] score=${l.northStarScore} agg=${l.perLensAgg}: ${l.justification}`).join('\n')}
Pick the SINGLE highest-leverage weakness NOT already well-solved. worthwhile=false only if the region is
genuinely at the Career bar (avg score >= 0.85). Concrete fixDirection citing files, strictly in scope.`,
    { schema: DIAGNOSE_SCHEMA, phase: `Iter ${iter} · Diagnose`, label: `synth${iter}` }
  )
  const baseScore = lensOuts.reduce((s, l) => s + (l.northStarScore || 0), 0) / (lensOuts.length || 1)
  if (!diag || !diag.worthwhile) { plateau++; ledger.push({ iter, result: 'plateau', baseScore }); log(`Iter ${iter}: at-bar / no target (${plateau}/${PLATEAU_STOP}).`); continue }
  log(`Iter ${iter}: target ${diag.target.question} — ${diag.target.problem.slice(0, 90)} (score ${baseScore.toFixed(2)})`)

  // ---- Propose ----
  phase(`Iter ${iter} · Propose`)
  const cands = await parallel(
    ANGLES.slice(0, N_CANDIDATES).map((angle, i) => () => {
      const tag = `i${iter}c${i + 1}`
      return agent(
        `Implement candidate #${i + 1} to improve the top two History sections.
TARGET: ${diag.target.question}
PROBLEM: ${diag.target.problem}
FIX DIRECTION: ${diag.target.fixDirection}
YOUR ANGLE: ${angle}
${SURFACE}
${NORTHSTAR}
Study the Career section first (components/profile/CareerSection.tsx and the primitives it uses) — you are
porting its QUALITY, not cloning its content. Reuse its primitives (AnimatedBar, AnimatedCount, TierBadge,
FlipCard, PPL_COLORS, tier colors) rather than inventing parallel ones.

You are in an ISOLATED git worktree copy (cwd). Steps:
1. If ./node_modules missing: \`ln -s ${NM} node_modules\`.
2. Implement a REAL, shippable change using existing theme tokens (useTheme colors/fonts). Stay strictly
   in scope. HONESTY: every gamified number must derive from real history data and be able to read
   "down/not yet" when the lifter regresses. No placeholders, no fake data.
3. Build gate MUST pass: \`${GATE}\` (tsc prints 0, then ESLINT_OK). Fix until it does.
4. \`git diff HEAD > ${CAP}/${tag}.diff\` and confirm non-empty. Do NOT render. Do NOT commit.
5. Return: strategy (state explicitly which Career primitives/mechanics you used and any motion judges
   can't see in a static frame), filesTouched, built, diffPath="${CAP}/${tag}.diff", notes.
If you cannot build, return built=false with the blocker in notes.`,
        { schema: CAND_SCHEMA, isolation: 'worktree', phase: `Iter ${iter} · Propose`, label: `cand:${tag}` }
      ).then((r) => (r ? { ...r, tag } : r))
    })
  )
  const built = cands.filter((c) => c && c.built && c.diffPath)
  if (!built.length) { plateau++; ledger.push({ iter, result: 'no-candidate', target: diag.target, baseScore }); log(`Iter ${iter}: no candidate built (${plateau}/${PLATEAU_STOP}).`); continue }

  // ---- Render (ONE agent, SEQUENTIAL, warm main repo) ----
  phase(`Iter ${iter} · Render`)
  const rr = await agent(
    `Render each candidate diff into a screenshot, in the MAIN repo at ${REPO} (cwd). Working tree must be
clean at the committed baseline. ONE AT A TIME (the helper mutates then reverts the tree):
${built.map((c, k) => `- tag ${c.tag}: diff at ${c.diffPath}, port ${5615 + iter * 5 + k}`).join('\n')}
For each: \`OUT=${CAP} bash visual-loop/render-candidate.sh <diffPath> <tag> <port>\`, confirm
${CAP}/<tag>-workouts-full.png exists, verify \`git status\` clean before the next.
Return rendered=[tags with a full-page png], failed=[...], notes.`,
    { schema: RENDER_SCHEMA, phase: `Iter ${iter} · Render`, label: `render:${iter}` }
  )
  const ready = built.filter((c) => rr && (rr.rendered || []).includes(c.tag))
  if (!ready.length) { plateau++; ledger.push({ iter, result: 'no-render', target: diag.target, baseScore, notes: rr && rr.notes }); log(`Iter ${iter}: no candidate rendered (${plateau}/${PLATEAU_STOP}).`); continue }

  // ---- Judge pairwise vs current, against the Career reference ----
  phase(`Iter ${iter} · Judge`)
  const judged = []
  for (const c of ready) {
    const lens = await judgeLenses(
      `Compare a CANDIDATE against the CURRENT top region.
Target addressed: ${diag.target.question} — ${diag.target.problem}
CURRENT (before): ${CAP}/${curTag}-workouts-full.png
CANDIDATE (after): ${CAP}/${c.tag}-workouts-full.png
CAREER REFERENCE (the bar): ${CAREER_REF}
Candidate strategy (includes motion a static frame can't show): ${c.strategy}
Judge PAIRWISE on the top region: better/same/worse on the target AND overall vs the Career bar?
meaningful or marginal? newProblems = kitsch, dishonest metrics, clutter, damage below Records or to the
Exercises tab. northStarScore = the CANDIDATE's closeness to the Career bar (current ~${baseScore.toFixed(2)}),
perLensAgg = 1..5. Marginal wins or any real regression must NOT read as 'meaningful better'.`,
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
    log(`Iter ${iter}: no candidate meaningfully improved without regression (${plateau}/${PLATEAU_STOP}).`)
    continue
  }

  // ---- Apply winner behind the gate ----
  phase(`Iter ${iter} · Apply`)
  const apply = await agent(
    `Land the winning improvement into the main worktree at ${REPO} (cwd), verify, commit.
WINNER strategy: ${winner.strategy}
Files: ${JSON.stringify(winner.filesTouched)}
Judged: ${winner.meaningful}/3 meaningful-better, score ${baseScore.toFixed(2)} -> ${winner.score.toFixed(2)}
Diff: ${winner.diffPath}
Steps:
1. Working tree must be clean. If not, report applied:false.
2. \`git apply ${winner.diffPath}\` (or reconstruct the same end state if it doesn't apply cleanly).
3. FULL gate: \`${GATE}\` (tsc 0, ESLINT_OK) AND \`node_modules/.bin/jest 2>&1 | tail -3\` all passing.
   If it can't pass, restore a clean tree and report applied:false.
4. Commit: "feat(history): <what> (career visual loop iter ${iter})". Do NOT push. Do NOT re-render.
5. Return applied, gatePassed, commit sha, notes.`,
    { schema: APPLY_SCHEMA, phase: `Iter ${iter} · Apply`, label: `apply:${iter}` }
  )
  if (apply && apply.applied && apply.gatePassed) {
    accepted++; plateau = 0; curTag = winner.tag
    ledger.push({ iter, result: 'accepted', target: diag.target, commit: apply.commit, score: `${baseScore.toFixed(2)}->${winner.score.toFixed(2)}`, strategy: winner.strategy })
    log(`Iter ${iter}: ✓ accepted ${apply.commit} — ${baseScore.toFixed(2)}->${winner.score.toFixed(2)} (total ${accepted})`)
  } else {
    plateau++
    ledger.push({ iter, result: 'apply-failed', target: diag.target, notes: apply && apply.notes })
    log(`Iter ${iter}: apply failed (${plateau}/${PLATEAU_STOP}) — ${apply && apply.notes}`)
  }
}

// ---- Cleanup: remove candidate worktrees this run spawned ----
phase('Cleanup')
await agent(`In ${REPO} (cwd): \`git worktree list\`, then for every worktree whose path or branch matches
this run's candidate pattern (vloop/career/cand or an agent-worktree under morph-worktrees created today by
this loop — NOT eval-routines-loop, notes-progress-career-parity, or routines-cand-*), run
\`git worktree remove --force <path>\`; then \`git worktree prune\`. Also delete any branches those
worktrees created (\`git branch -D <branch>\`). Return the remaining \`git worktree list\`.`,
  { phase: 'Cleanup', label: 'cleanup' })

const stop = plateau >= PLATEAU_STOP ? `plateau (${PLATEAU_STOP} non-improving rounds)` : `reached maxIterations ${MAX}`
log(`Career visual loop done: ${accepted} improvements accepted. Stopped: ${stop}.`)
return { accepted, iterationsRun: ledger.length, stopReason: stop, finalBaselineTag: curTag, ledger }
