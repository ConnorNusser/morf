# History Page Eval Rubric

Every scenario is scored on these dimensions. Weighted total = `Σ(score × weight) / Σweight`, per scenario, then averaged across scenarios for the page-level score.

Scores are 1–5. **Objective** dimensions are asserted in code (deterministic, gate the loop). **Subjective** dimensions are LLM-judged (screenshot when capture lands; JSX + data reasoning until then).

| # | Dimension | Type | Weight | 5 = | 1 = |
|---|-----------|------|--------|-----|-----|
| 1 | **Correctness** | objective | 3 | Every displayed number matches the golden value computed independently from the fixture | Any headline number wrong |
| 2 | **No-crash / renders** | objective | 3 | Page + all modals render for the fixture without error | Throws / blank on some fixture |
| 3 | **Empty & edge states** | objective | 2 | New-user, single-workout, lapsed, 0-weight, bodyweight, kg all render a sensible, intentional state | Blank card or nonsense (NaN, "undefined", empty chart) |
| 4 | **Performance** | objective | 1 | Dense fixture (150+ workouts) renders under budget, scroll stays smooth | Jank / long blocking derivation on mount |
| 5 | **Information hierarchy** | subjective | 2 | Most important thing (recent progress / next action) is what the eye hits first; clear scan path | Flat wall of equal-weight cards |
| 6 | **Visual consistency** | subjective | 1 | Matches design system (spacing, type, color, radius); no orphan styles | Inconsistent, off-theme, cramped |
| 7 | **Actionability** | subjective | 2 | The page tells you something you'd act on — a trend, a PR, what to train next | Pure log dump, no insight |

Weight rationale (per Connor: "all three, weighted"): correctness + not-crashing dominate (a pretty page with wrong numbers is worse than useless), visual + actionability are meaningful but secondary until the data is trustworthy.

## Objective gate (hard floor — a candidate that fails ANY of these is discarded before judging)
- `tsc --noEmit` clean
- existing test suites green
- correctness asserts pass on all fixtures (dimension 1)
- no-crash asserts pass on all fixtures (dimension 2)

## Judge protocol (subjective dims)
- 3 independent judge agents per scenario, scores averaged (denoise).
- Each judge gets: the fixture description, the rendered output (screenshot later / JSX + derived data now), the rubric row, and 1–2 reference examples of a great activity/history view.
- Judge returns `{score, oneLineCritique}` per subjective dimension. Critiques feed the next iteration's diagnose step.
