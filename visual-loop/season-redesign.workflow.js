export const meta = {
  name: 'history-season-redesign',
  description: 'One-round redesign: LIFTS + SESSIONS as a single "season page" (standings + match results), 3 sub-metaphor candidates, judged for cohesion (with each other AND the rest of the History page) + adult playfulness',
  phases: [
    { title: 'Setup', detail: 'render the current baseline (post system-font)' },
    { title: 'Propose', detail: '3 candidates: box score / form guide / trading card' },
    { title: 'Render', detail: 'screenshot each candidate in the warm main repo' },
    { title: 'Judge', detail: '3-lens pairwise judgment vs current' },
    { title: 'Apply', detail: 'land the winner behind the full gate' },
  ],
}

const REPO = '/Users/connor/repo/morph'
const NM = '/Users/connor/repo/morph/node_modules'
const CAP = '/private/tmp/claude-501/-Users-connor-repo-morph-worktrees/a215d1fd-38af-4356-8a30-463d97a5feb2/scratchpad/vloop-season'
const GATE = `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.json 2>&1 | grep -c "error TS" ; npx eslint . --ext .ts,.tsx --max-warnings 0 >/dev/null 2>&1 && echo ESLINT_OK || echo ESLINT_FAIL`

const BRIEF = `Redesign the top of the History Workouts tab — the LIFTS board (components/history/LiftProgressWidget.tsx)
and the SESSIONS feed (components/history/SessionsFeed.tsx) — as ONE designed object, not two components:
a lifter's SEASON PAGE, the way a sports app shows a season.

THE METAPHOR: LIFTS is the STANDINGS TABLE — each lift is a competitor: current grade (the existing tier
badge), form over recent months (the existing best-set-per-month data). SESSIONS is the MATCH RESULTS —
each workout is a game played: a box score with a headline moment. Standings and results in a sports app
are always one visual system — same type ramp, same row anatomy, same accent logic. Design to that bar.

COHESION IS A HARD CONSTRAINT, at two levels:
1. Between the two sections: they must share at least three concrete primitives — the same micro-label
   header grammar, the same chip/pill shape, the same divider rhythm, the same ONE accent rule. Test:
   screenshot one row from each section side by side — they must look like the same app made them.
2. With the REST of the History page: Records / Your Movers / This Week / Muscle Balance sit directly
   below (flat, hairline-divided, system font, quiet section headings) and the Exercises tab is a sibling.
   The season page must read as the top of THAT page — same flatness, same density, no foreign surface
   treatments (no heavy cards, no new background colors). You may NOT edit those other sections; cohere
   by matching them.

PLAYFUL MEANS: the PPL split colors (lib/data/pplCategories PPL_COLORS) as TEAM COLORS — used sparingly
but proudly; form told visually (a win/loss-style month strip, a streak mark); exactly ONE celebration
moment on the whole screen (the latest PR, treated like a match-winning highlight); motion on entry
(AnimatedBar/AnimatedCount exist). Playful does NOT mean: mascots, emoji, badges-for-everything,
confetti, or any number that can't go down.

KEEP EVERY FACT currently shown: monthly best sets per lift, tier + gap-to-next (flip-back or otherwise),
session lineup (what happened), volume/sets/time, PR gain. System font only (fontWeight, never
fontFamily), existing theme tokens (useTheme colors), honest numbers throughout. Scope: LiftProgressWidget,
SessionsFeed, lib/history/liftProgress.ts, lib/history/sessionRecap.ts, and history.tsx wiring of these
two ONLY.`

const ANGLES = [
  ['box-score', 'Sub-metaphor: THE BOX SCORE. Sessions as compact match reports — a scoreline row (the PR set as the "final score"), a stat line, the lineup as the roster. LIFTS as the league table above: rank-ordered rows, grade column, form column. Think ESPN box scores: dense, columnar, scannable, quietly colorful.'],
  ['form-guide', 'Sub-metaphor: THE FORM GUIDE. Lead with form/momentum everywhere: each lift row gets a W/L-style month strip (up-month / down-month marks in team color), each session gets a momentum mark vs the previous one. Betting-site form guides are playful through tiny repeated glyphs, not decoration. Keep rows one line where possible.'],
  ['trading-card', 'Sub-metaphor: THE TRADING CARD / ROSTER. Lifts as roster entries with a team-color spine and grade; the latest session as the "featured card" with one stat celebrated; past sessions as compact roster rows. Uses the existing FlipCard affordance as the card flip. Restraint rule: cards are FLAT (hairline borders, no shadows/gradients).'],
]

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
  type: 'object', required: ['verdict', 'magnitude', 'newProblems', 'cohesionScore', 'playfulScore', 'justification'],
  properties: {
    verdict: { type: 'string', enum: ['better', 'same', 'worse'] },
    magnitude: { type: 'string', enum: ['meaningful', 'marginal'] },
    newProblems: { type: 'array', items: { type: 'string' } },
    cohesionScore: { type: 'number', description: '0..1: the two sections as one system AND as the top of this page (vs Records/This Week below)' },
    playfulScore: { type: 'number', description: '0..1: adult playfulness — team color, form glyphs, one celebration; kitsch scores LOW' },
    justification: { type: 'string' },
  },
}
const APPLY_SCHEMA = {
  type: 'object', required: ['applied', 'gatePassed', 'commit', 'notes'],
  properties: { applied: { type: 'boolean' }, gatePassed: { type: 'boolean' }, commit: { type: 'string' }, notes: { type: 'string' } },
}

phase('Setup')
await agent(`Render the CURRENT baseline History screen. cwd: ${REPO}
1. \`mkdir -p ${CAP}\`
2. \`OUT=${CAP} bash visual-loop/render.sh baseline 5660\`
3. Confirm ${CAP}/baseline-workouts-full.png exists (ls -la). Return "ok" or the failure.`,
  { phase: 'Setup', label: 'setup' })

phase('Propose')
const cands = (await parallel(
  ANGLES.map(([key, angle]) => () =>
    agent(`${BRIEF}

YOUR ANGLE — ${angle}

You are in an ISOLATED git worktree copy (cwd). Steps:
1. If ./node_modules missing: \`ln -s ${NM} node_modules\`.
2. Implement a REAL, shippable redesign. Rewrite the two components as boldly as the metaphor demands —
   this is a redesign, not a tweak — but stay strictly in scope and keep every fact.
3. Build gate MUST pass: \`${GATE}\` (tsc prints 0, then ESLINT_OK). Fix until it does.
4. \`git diff HEAD > ${CAP}/${key}.diff\` and confirm non-empty. Do NOT render. Do NOT commit.
5. Return: strategy (name the ≥3 shared primitives and where the ONE celebration lives; note any motion a
   static frame can't show), filesTouched, built, diffPath="${CAP}/${key}.diff", notes.`,
      { schema: CAND_SCHEMA, isolation: 'worktree', phase: 'Propose', label: `cand:${key}` }
    ).then((r) => (r ? { ...r, tag: key } : r))
  )
)).filter(Boolean).filter((c) => c.built && c.diffPath)
if (cands.length === 0) { log('No candidate built.'); return { applied: false, reason: 'no candidate built' } }

phase('Render')
const rr = await agent(
  `Render each candidate diff into screenshots in the MAIN repo at ${REPO} (cwd). Working tree must be
clean. ONE AT A TIME (the helper mutates then reverts the tree):
${cands.map((c, k) => `- tag ${c.tag}: diff at ${c.diffPath}, port ${5661 + k}`).join('\n')}
For each: \`OUT=${CAP} bash visual-loop/render-candidate.sh <diffPath> <tag> <port>\`, confirm
${CAP}/<tag>-workouts-full.png exists, verify \`git status\` clean before the next.
Return rendered=[tags], failed=[tags], notes.`,
  { schema: RENDER_SCHEMA, phase: 'Render', label: 'render' }
)
const ready = cands.filter((c) => rr && (rr.rendered || []).includes(c.tag))
if (ready.length === 0) { log('No candidate rendered.'); return { applied: false, reason: 'no candidate rendered' } }

phase('Judge')
const LENSES = [
  ['design-director', 'Judge craft and COHESION at both levels: do LIFTS and SESSIONS read as one system (side-by-side row test), and does the whole top region read as the top of THIS page — same flatness, density, and type as Records / Your Movers / This Week below it in the full-page screenshot?'],
  ['the-lifter', 'You are a serious gym-goer. Judge whether the season/athlete framing lands: does it make training feel like a season you are playing, do you want to check it after every workout? Reward form-at-a-glance and one earned celebration; punish anything that reads as a toy.'],
  ['the-skeptic', 'Hunt for kitsch, sports-cosplay that obscures data, lost facts (monthly bests, tier gaps, lineup, volume/sets/time must all survive), dishonest always-up framing, and foreign surface treatments that clash with the rest of the page. Hard to impress.'],
]
const judged = []
for (const c of ready) {
  const lens = (await parallel(LENSES.map(([name, l]) => () =>
    agent(`You are the ${name.toUpperCase()} lens on a 3-judge visual panel. ${l}
${BRIEF}
Compare CANDIDATE vs CURRENT (full-page screenshots — judge the top region, but page-level cohesion
includes how it sits above the untouched sections below):
CURRENT: ${CAP}/baseline-workouts-full.png
CANDIDATE: ${CAP}/${c.tag}-workouts-full.png
Candidate strategy (includes motion a static frame can't show): ${c.strategy}
Pairwise: better/same/worse overall? meaningful or marginal? newProblems = kitsch, lost facts, page-level
clashes. cohesionScore and playfulScore per the schema. Marginal wins or any real regression must NOT
read as 'meaningful better'.`,
      { schema: JUDGE_SCHEMA, phase: 'Judge', label: `${c.tag}:${name}` })
  ))).filter(Boolean)
  const cohesion = lens.reduce((s, l) => s + (l.cohesionScore || 0), 0) / (lens.length || 1)
  const playful = lens.reduce((s, l) => s + (l.playfulScore || 0), 0) / (lens.length || 1)
  const meaningful = lens.filter((l) => l.verdict === 'better' && l.magnitude === 'meaningful').length
  const worse = lens.filter((l) => l.verdict === 'worse').length
  const newProblems = [...new Set(lens.flatMap((l) => l.newProblems || []))]
  judged.push({ ...c, cohesion, playful, meaningful, worse, newProblems, score: cohesion + playful })
  log(`${c.tag}: ${meaningful}/3 meaningful-better, ${worse} worse — cohesion ${cohesion.toFixed(2)}, playful ${playful.toFixed(2)}`)
}

const eligible = judged.filter((j) => j.meaningful >= 2 && j.worse === 0)
const winner = eligible.sort((a, b) => b.score - a.score)[0]
if (!winner) {
  log('No candidate won — nothing applied. Candidate diffs + screenshots remain in ' + CAP)
  return { applied: false, judged: judged.map(({ tag, cohesion, playful, meaningful, worse, newProblems }) => ({ tag, cohesion, playful, meaningful, worse, newProblems })) }
}

phase('Apply')
const apply = await agent(
  `Land the winning season-page redesign into the main worktree at ${REPO} (cwd), verify, commit.
WINNER: ${winner.tag} — ${winner.strategy}
Diff: ${winner.diffPath}
1. Tree must be clean (loop-tooling dirt in visual-loop/ is fine). 2. \`git apply ${winner.diffPath}\`
(reconstruct if needed). 3. FULL gate: \`${GATE}\` AND \`node_modules/.bin/jest 2>&1 | tail -3\` all
passing; else restore clean tree, applied:false. 4. Commit "feat(history): season-page redesign of
LIFTS + SESSIONS (${winner.tag})". Do NOT push. 5. Return applied, gatePassed, commit, notes.`,
  { schema: APPLY_SCHEMA, phase: 'Apply', label: 'apply' }
)

// Cleanup candidate worktrees/branches this run created.
await agent(`In ${REPO}: \`git worktree list\`; remove (--force) every worktree created by this run's
candidates (paths/branches containing this session's agent-worktree pattern or the tags box-score /
form-guide / trading-card), NOT eval-routines-loop / notes-progress-career-parity / routines-cand-*.
Then \`git worktree prune\` and delete their branches. Return the remaining list.`,
  { phase: 'Apply', label: 'cleanup' })

log(apply && apply.applied ? `Applied ${apply.commit}` : `Apply failed: ${apply && apply.notes}`)
return { applied: !!(apply && apply.applied), winner: winner.tag, cohesion: winner.cohesion, playful: winner.playful, runnersUp: judged.filter((j) => j.tag !== winner.tag).map(({ tag, cohesion, playful, meaningful, worse }) => ({ tag, cohesion, playful, meaningful, worse })), commit: apply && apply.commit }
