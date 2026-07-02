# History Page — Autonomous Improvement Loop

A self-improving loop for `app/(tabs)/history.tsx` + `components/history/`. The mechanics are cheap; the **eval signal is the whole game**. This harness makes "is it actually better?" a scored, regression-guarded question so the loop climbs monotonically instead of drifting.

## Layout
```
history-eval/
  README.md          – this file
  rubric.md          – weighted dimensions + scoring protocol
  scoreboard.json    – ledger: score per scenario per iteration (the ratchet)
  fixtures/          – deterministic synthetic history states (the "scenarios")
  goldens.ts         – independent recomputation of what each fixture SHOULD surface
  correctness.test.ts– asserts the page's real selectors == goldens (objective gate)
  loop.workflow.js   – the orchestration: diagnose → propose → gate → judge → select
  insights.md        – running research + mined judge critiques (fed into diagnose)
```

## The ratchet (why it improves over time)
`scoreboard.json` holds the best score each scenario has ever reached. **A candidate change is merged only if the weighted aggregate improves AND no scenario regresses below its prior best.** If nothing beats baseline, the iteration is discarded and logged. That single rule is the difference between autonomous improvement and an autonomous random walk.

## One iteration
1. **Diagnose** — run eval on current `main` of the branch; pick the lowest-scoring scenario×dimension (biggest lever), pull relevant lines from `insights.md`.
2. **Propose** — generate 2–3 *independent* candidate diffs targeting that weakness, each in its own worktree.
3. **Gate** — `tsc` + tests + correctness/no-crash asserts must pass. Fail = discard candidate.
4. **Judge** — capture + 3-judge score on all scenarios for each surviving candidate.
5. **Select** — merge the candidate maximizing aggregate with zero regression; else discard all, log why.
6. **Record** — append scores to `scoreboard.json`, append critiques to `insights.md`.

Repeat until improvement < ε for K rounds, or the token/time budget is hit. Human checkpoint: review merged diffs + before/after each batch.

## Signal fidelity (staged)
- **Now (code-only):** correctness/no-crash/perf are real runnable asserts; subjective dims judged from JSX + derived fixture data. Runs anywhere, no simulator.
- **Later (capture):** add sim fixture-loading + `xcrun simctl io booted screenshot`; the subjective judge upgrades from reading code to seeing pixels. Everything else stays.

## Running it
The loop is driven by the `Workflow` tool against `loop.workflow.js`. The correctness harness runs standalone: `jest history-eval/correctness.test.ts`.
