# Generation Prompt Changelog — driven by the eval harness

The prompt is iterated as a **regression-tested artifact**: every change is measured
against the eval harness (`lib/workout/routineQualityEval.ts`), and kept only if the
aggregate score rises *and* the golden set still passes
(`goldenRoutines.test.ts`).

## How to iterate (the Phase 5 loop)

1. **Baseline.** Run the harness in live mode against the real generator across the
   scenario matrix → record mean score + the per-issue failure histogram:

   ```ts
   import { runEval, formatEvalReport, EVAL_SCENARIOS } from '@/lib/workout/routineQualityEval';
   import { aiRoutineGenerator } from '@/lib/ai/aiRoutineGenerator';

   const res = await runEval(async (s) => {
     const { routines } = await aiRoutineGenerator.generateValidatedProgram(
       { programTemplate: 'custom', trainingGoal: s.goal as any, weeklyDays: s.daysPerWeek },
     );
     return routines;
   }, EVAL_SCENARIOS, /* reps */ 3);
   console.log(formatEvalReport(res.aggregate));
   ```
   (Live mode needs `EXPO_PUBLIC_GEMINI_API_KEY`. CI runs the harness in mock mode
   over fixtures — no API.)

2. **Target the top failure.** The histogram names the rule the generator breaks
   most (e.g. `ordering 28%`). Edit the prompt / split templates to address it.

3. **Re-measure.** Re-run the harness. **Keep the change only if** mean score rises
   and `goldenRoutines.test.ts` still passes. Record the result below.

## Versions

### v2 — Quality Contract injected *(current)*
Added an explicit "QUALITY CONTRACT" block to the system prompt that mirrors the
rubric (compounds-first ordering, a compound per day, weekly muscle coverage,
push/pull balance, hypertrophy 2×/wk + ~8–20 sets/muscle, strength low-rep).
**Hypothesis:** more programs pass on the first pass, reducing self-repair
iterations (cost/latency) and raising mean score.
_Measure: run the harness live before/after and paste the deltas here._

### v1 — Baseline
Template-guided prompt with STRICT RULES (exercise list + critical requirements),
no explicit quality contract. Self-repair loop (Phase 4) catches misses post-hoc.

## Guardrails
- A prompt change is only accepted if the **golden set stays ≥90** — the prompt can
  never be "optimized" into producing programs the rubric itself would have to be
  loosened to accept.
- The self-repair loop is the safety net: even a regressed prompt still gets
  verified + repaired before anything reaches the user.
