# History Section — Visual/Usefulness Judge Spec

The reward function for the visual improvement loop. Built on one principle:

> **A history screen gets better as it shortens the distance from *looking* to *knowing*.**
> Visual craft is the machinery; understanding-per-glance is the goal. The judge scores
> understanding, and craft wins only because it produces it.

The judge is **task-based, not vibes-based**: a lifter brings specific questions to their
history; usefulness = how well the screen answers them. We score against the questions,
not against abstract prettiness. Gamification/animation score only if they move these
numbers — otherwise neutral or penalized.

---

## Part 1 — The question list (the usefulness spec)  ← LOCK THIS FIRST

Each question is something a lifter actually wants from history. `weight` sets how much it
drives the score. `home?` flags questions that may belong to another screen (Home/Today,
Workout) rather than History — decide per question whether History owns it.

| # | Question (what the lifter wants to know) | Why it matters | Weight | Home? |
|---|------------------------------------------|----------------|--------|-------|
| Q1 | **Am I getting stronger overall?** (the macro trend) | The #1 reason to open history | 3 | history |
| Q2 | **How is *this specific lift* progressing?** (per-exercise trajectory) | Most actionable — drives what to load next | 3 | history |
| Q3 | **Did I PR, and what are my current records?** | Motivation + reference points | 2 | history |
| Q4 | **Am I being consistent, or slipping?** (streak / frequency / gaps) | Behavior driver; catches drop-off | 2 | history |
| Q5 | **How much work am I doing?** (volume over time) | Effort/overload signal | 2 | history |
| Q6 | **Am I balanced or neglecting something?** (muscles / movement patterns) | Programming quality | 2 | history |
| Q7 | **What did I do last session?** (to plan today) | Planning aid | 1 | history |

*Q8 ("what should I do next / am I due?") was cut — it belongs to Home/Today, not History.*

**Locked (2026-07-03):** Q1–Q7 as above. Q8 dropped as out-of-scope.

---

## Part 2 — Per-question scoring (the four sub-measures)

For each in-scope question, the judge locates where the screen answers it, then scores:

| Sub-measure | 1 (worst) | 5 (best) |
|-------------|-----------|----------|
| **Access / findability** | Not answered anywhere, or requires hunting/scrolling/tapping to find | Answer is exactly where you'd expect, immediately locatable |
| **Time-to-answer** | Requires real reading + work | Preattentive — a glance (rising line, color, one big number) |
| **Insight vs. raw** ×2 | Dumps raw inputs; you compute the delta/trend in your head | Hands you the *derived* answer ("+18 lb this month, trending up") |
| **Confidence** | Ambiguous; you second-guess the answer | Unambiguous, trustworthy at a glance |

`insight-vs-raw` is weighted ×2 — it's the biggest lever (great data design does the
thinking for you). A question not answered at all → access=1 and flagged as a **coverage gap**.

`questionScore = mean(access, time, 2×insight, confidence)` → 1–5.
`usefulness = Σ(weight × questionScore) / Σ(weight × 5)` → 0–1.

---

## Part 3 — Screen-level craft (diagnostic, instrumental)

Not scored for their own sake — they *explain* the per-question scores and guide fixes:
- **Focal hierarchy** — one hero the eye hits first, then a scan path (vs a flat wall of cards).
- **Signal-to-noise** — every element informs; chrome/decoration/redundant labels are noise taxing every glance.
- **Comparison made visual** — progress is comparative; is now-vs-before shown as a line/bar/marker, not two numbers to subtract?
- **Progressive disclosure** — overview at a glance, detail on tap (right granularity at the right time).
- **Meaningful grouping** — organized how a lifter thinks (by lift / time / goal).

The judge notes which of these are hurting which questions.

---

## Part 4 — Scoring mechanics (what drives *overhaul*, not refinement)

1. **Pairwise + meaningful/marginal.** Never a bare absolute score. Candidate vs current, per
   question: `better | same | worse` and `meaningful | marginal`. A candidate whose wins are
   all *marginal* is **rejected** — stagnation must lose. This is the antidote to
   "60 rounds of nothing."
2. **Gap-to-north-star.** Score each question's distance from the reference bar (Part 7). The
   loop climbs toward the star and **stops when it reaches the bar — not when diffs get small.**
3. **Overhaul meta-judgment.** Each round the judge rates: *"Does this screen need a redesign or
   a tweak?"* and *"Did the candidate deliver that?"* Redesign-worthy screen + tweak-only
   candidate → hard penalty. Forces rethinking when warranted.

---

## Part 5 — Anti-superficiality guards (explicit deductions)

Each is a penalty, not neutral:
- Decoration that doesn't aid comprehension.
- Clutter / anything that lowers legibility or raises time-to-answer.
- Bolted-on or childish gamification for a serious lifter.
- Gratuitous motion, or motion that distracts from the data.
- New feature that adds surface area without answering a Part-1 question better.

---

## Part 6 — Judge protocol (reliability)

Vision judges drift and flatter. Counter with **3 diverse lenses per candidate**, each forced
to justify every score against the specific question it serves, then majority:
- **Design director** — hierarchy, craft, signal-to-noise.
- **The lifter** — can I answer my questions (Part 1) fast and confidently?
- **The skeptic** — hunt for clutter, gimmicks, marginal-dressed-as-meaningful, regressions.

Judge input: rendered screenshot(s) of current + candidate (and later a short interaction clip
for motion). Judge output (per lens), schema sketch:

```
{
  perQuestion: [{ id, access, time, insight, confidence, answeredWhere, gap: bool,
                  vsPrevious: "better|same|worse", magnitude: "meaningful|marginal" }],
  craftNotes: [{ principle, hurtingQuestions, note }],
  overhaulVerdict: { screenNeeds: "redesign|tweak", candidateDelivered: "redesign|tweak|none" },
  deductions: [{ guard, note }],
  usefulness: 0..1,
  gapToNorthStar: 0..1,
  recommendation: "accept|reject",
  justification: "..."
}
```

Accept if: majority meaningful-better on weighted questions, no high-weight regression, no
overhaul-mismatch penalty, clears the correctness floor (tsc/tests — data must stay right).

---

## Part 7 — North star

Not "looks like Whoop." The bar: **a lifter extracts more true understanding per second here
than on any competitor's history/progress screen**, and the questions they care about feel
*reachable*, not buried. Anchor references:
- **Robinhood (primary bar)** — minimalist design carrying a lot of value, *simply*. The
  gold standard for dense data + radical restraint + instant at-a-glance understanding. Maps
  almost 1:1 onto history:
  - portfolio value (one big hero number) → strength/progress hero (Q1)
  - the period line chart + timeframe toggle → the strength trend (Q1)
  - green/red day change → direction & magnitude of progress (insight-vs-raw done right)
  - the holdings list, each with its own sparkline/change → per-lift breakdown (Q2)
  - tap-any-row-to-drill → progressive disclosure (detail on demand)
  Principle to steal: **almost nothing on screen, yet every question answered.** When in doubt,
  remove, don't add.
- Your own **career/profile section** — the internal quality bar you already like.

---

## Part 8 — Convergence

Stop when `gapToNorthStar` closes (quality bar hit) or N rounds pass with only marginal
candidates. **Never** stop just because diffs got small — that's the failure we're fixing.
