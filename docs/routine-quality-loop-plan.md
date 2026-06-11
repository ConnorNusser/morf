# Routine Generation Quality Loop — Implementation Plan

A phased plan to turn the one-shot routine generator into a **self-improving,
science-grounded system**, built on the verifier we already have
(`validateRoutineQuality`). Each phase is independently shippable.

---

## 0. Where we are today

**The clickable flow** (`components/workout/RoutineGeneratorModal.tsx`):

```
goal → focus → experience → days → duration → exercises → [generating] → success
        (collect structured params via a tap-through wizard)
                              │
                              ▼
 selectProgramTemplate(goal, days)  ──► aiRoutineGenerator.generateRoutineProgram(opts)
                              │            (Gemini, template-guided prompt; deterministic fallback)
                              ▼
                     convertToRoutines()  ──► Routine[]  ──► saved
                              │
                              └─ validateRoutineQuality()  ← we added this; currently LOGS ONLY
```

**Limitations (why it's "probably limited"):**

1. **One-shot, no feedback.** Generate → convert → save. The verifier runs *after*
   the fact and does nothing — bad output ships to the user.
2. **Score is invisible & inert.** Quality isn't shown, gated on, or acted on.
3. **Static prompt, unmeasured.** No way to know which prompt/template versions
   actually produce good routines, or which rules they violate most.
4. **Coarse muscle taxonomy.** `legs`/`back` span several muscles, so the most
   scientific checks (per-muscle weekly volume vs MEV–MRV, 2×/wk frequency)
   can't be computed without false positives. **This is the foundational blocker.**
5. **Deterministic template pick.** `selectProgramTemplate(goal, days)` is a fixed
   lookup — no adaptation to the verifier's findings.
6. **No outcome signal.** Whether users keep/complete/progress on a generated
   routine never feeds back.

**The good news:** the hard part — an objective fitness function — exists. The rest
is wiring loops around it at three cadences:

```
  ┌─ per-generation ──┐   ┌─ offline (dev) ─────┐   ┌─ long-run (prod) ──┐
  │ generate→verify→  │   │ eval harness →      │   │ adherence +        │
  │ repair (Self-     │   │ prompt evolution    │   │ progression →      │
  │ Refine loop)      │   │ (regression-tested) │   │ re-weight rubric   │
  └───────────────────┘   └─────────────────────┘   └────────────────────┘
        Phase 4                 Phases 3,5                  Phase 6
              all standing on Phases 0–2 (the science + guardrails)
```

---

## Phase 0 — Finer muscle taxonomy *(foundation; unblocks everything scientific)*

**Why first:** every volume/frequency landmark needs per-muscle resolution. Without
it, the rubric stays heuristic.

**Build:**
- Add a `SubMuscle` union (`quads | hamstrings | glutes | calves | chest | front_delts
  | side_delts | rear_delts | lats | upper_back | traps | biceps | triceps | forearms
  | abs | lower_back`). Keep the existing coarse `MuscleGroup` for UI.
- `lib/data/exerciseMuscles.ts`: `EXERCISE_SUBMUSCLES: Record<exerciseId, { primary: SubMuscle[]; secondary: SubMuscle[] }>` for the ~68 DB exercises. Secondary muscles count as **0.5 sets** (RP convention).
- A pure helper `setsPerSubMuscle(program): Record<SubMuscle, number>` (weekly), with the 0.5 weighting and warmup exclusion.

**Acceptance:** unit test that a PPL week resolves sane per-sub-muscle weekly sets
(e.g. chest ≈ 12–18, not "push = 40"). No UI change.

**Effort:** ~½ day (mostly data entry for 68 exercises).

---

## Phase 1 — Scientific rubric v2 *(the verifier, upgraded)*

**Build** (extend `lib/workout/routineQuality.ts`):

Turn each check into a **cited, tunable rule** with a source tag and weight:

```ts
interface QualityRule { code: string; source: string; severity; weight: number; }
```

New science-grounded rules (goal-aware — thresholds switch on `trainingGoal`):

| Rule | Standard | Source |
|---|---|---|
| Weekly sets/muscle in MEV→MRV | hypertrophy ~10–20; strength lower | Schoenfeld 2017; RP volume landmarks |
| Frequency ≥2×/week per muscle | 2× ≥ 1× at equated volume | Schoenfeld 2016 meta |
| Rep/load matched to goal | strength 1–6 @ ≥80%; hypertrophy 6–15 | ACSM; Schoenfeld 2021 |
| Multi-joint before single-joint | already have (`ordering`) | ACSM position stand |
| CNS-heavy spacing (squat+DL) | already have (`validateRoutines`) | — |
| Progressive overload present | sets carry progression state | Helms/RP |

Keep the existing robust checks (push/pull balance, compound-per-day, volume/rep
sanity) as the floor. Score stays 0–100; thresholds live in one `RUBRIC` table so
they're tunable in one place.

**Acceptance:** the powerlifting split (scores 100 today) still passes; a known
under-volumed program (e.g. each muscle 1×/wk, 4 sets) now flags `low-frequency` +
`under-volume`. New rule tests.

**Effort:** ~1 day.

---

## Phase 2 — Golden-set calibration *(the guardrail; do alongside Phase 1)*

**Why:** stops the rubric from drifting into pseudo-science. Proven programs are
ground truth — if a rule fails them, the rule is wrong.

**Build:**
- `lib/workout/__tests__/goldenRoutines.ts`: encode 5–8 battle-tested programs as
  `Routine[]` fixtures — **5/3/1, nSuns, PHUL, PHAT, Reddit PPL, Starting Strength,
  Upper/Lower**.
- Regression test: **every golden program scores ≥ 90** and `passed === true`.
- This test gates every future rubric change (CI red if a rule breaks a known-good
  program).

**Acceptance:** all golden programs ≥90; the suite is part of `npm test`.

**Effort:** ~½–1 day (encoding the programs).

---

## Phase 3 — Eval harness *(measurement; "you can't improve what you can't measure")*

**Build:**
- `lib/workout/routineQualityEval.ts`: a scenario matrix
  `{ goal × daysPerWeek × experience × equipment × focus }` and an aggregator that,
  given a generator function, produces:
  - mean score, pass rate, score distribution
  - **failure rate per issue code** (the actionable part — e.g. `ordering: 28%`)
- Two run modes:
  - **Mock/cassette mode** (default, no API cost): replay recorded Gemini outputs or
    the deterministic fallback, so it runs in CI deterministically.
  - **Live mode** (manual, gated by API key): hit Gemini for a fresh read.
- Output a one-screen report (logged, like the throwaway spec we used to validate the
  powerlifting split).

**Acceptance:** `npx jest routineQualityEval` prints a baseline score + per-code
failure histogram for the current prompt.

**Effort:** ~1 day.

---

## Phase 4 — Runtime self-repair loop *(the product win; changes the clickable flow)*

**The Self-Refine pattern**, wired between generate and save:

```ts
// in aiRoutineGenerator: generateValidatedProgram(opts)
let program = await this.callAI(buildPrompt(opts));
for (let i = 0; i < MAX_REPAIRS; i++) {           // MAX_REPAIRS ≈ 2
  const routines = await this.convertToRoutines(program);
  const report = validateRoutineQuality(routines, opts.trainingGoal);
  if (report.passed) return { program, report };
  program = await this.callAI(buildRepairPrompt(program, report.issues)); // feed exact violations back
}
return this.bestOf(candidates) ?? this.generateFallbackProgram(opts);     // never ship junk
```

- `buildRepairPrompt`: hands the model its own JSON + the specific issues
  ("Day 2 puts Lateral Raise before Bench — compounds first") and asks it to fix
  **only those**. Objective verifier in the loop ⇒ quality climbs with no human review.
- **Cost control:** cap at `MAX_REPAIRS`; fall back to the deterministic template
  (which we'll have proven ≥90 via the golden set) if still failing.

**Clickable-system changes** (`RoutineGeneratorModal.tsx`):
- The existing `generating` step already cycles status messages — show
  *"Refining for quality…"* during repair iterations (no new screen).
- On `success`, surface the score: **"Quality 94/100 ✓ · balanced, 2×/wk frequency"**
  with the top strengths; if it only just passed, an **"Improve"** button runs one
  more repair pass.
- Never present a `failed` routine without a visible caveat + regenerate option.

**Acceptance:** generations that previously logged warnings now self-correct before
reaching `success`; eval-harness pass rate rises measurably vs Phase 3 baseline.

**Effort:** ~1–2 days (loop + repair prompt + modal wiring).

---

## Phase 5 — Prompt-evolution loop *(the meta-loop; how the prompt itself improves)*

**Build (a dev workflow, not shipped code):**
1. Run the Phase 3 harness → failure histogram.
2. Edit `routineGeneration.prompt.ts` / `splitTemplates.ts` to target the top failure
   mode (e.g. add an explicit ordering + frequency contract to the prompt).
3. Re-run the harness; **keep the change only if aggregate score rises** and the
   golden set still passes. Each prompt version gets a number — it's a regression test
   for the prompt.
4. *(Advanced, optional)* an LLM "prompt-engineer" reads the histogram, proposes prompt
   diffs, you A/B them on the harness, keep winners — gated behind the golden set so it
   can't optimize into nonsense.

**Acceptance:** a documented prompt changelog where each version's harness score is
recorded and monotonically non-decreasing.

**Effort:** ongoing; ~1 day to set up the workflow + first iteration.

---

## Phase 6 — Outcome feedback *(long-run; closes the real loop)*

The rubric is a proxy; the truth is **did the user keep it, complete it, progress on it?**

**Build:**
- Persist the quality report alongside each saved routine.
- Log adherence (sessions completed vs prescribed) and progression (weight/volume
  trend) per generated routine.
- Periodically correlate rubric components with real adherence/progression; re-weight
  the `RUBRIC` toward what predicts outcomes. Catches "technically scientific but
  nobody follows it."

**Acceptance:** a dashboard/report relating quality score to retention/progression;
at least one rubric weight adjusted from real data.

**Effort:** larger; depends on analytics plumbing — schedule after Phases 0–5 prove out.

---

## Sequencing & dependencies

```
Phase 0 (taxonomy) ──┬─► Phase 1 (rubric v2) ──► Phase 2 (golden set, gates 1)
                     │                              │
                     └────────────────────────────►├─► Phase 3 (eval harness)
                                                    │        │
                                                    │        ├─► Phase 4 (self-repair → ships)
                                                    │        └─► Phase 5 (prompt evolution)
                                                    └─► Phase 6 (outcomes, later)
```

**Recommended order:** 0 → 1 → 2 → 3 → 4, then 5 continuously, 6 when analytics allow.
Phase 4 is the first user-visible win; Phases 0–3 make it trustworthy and measurable.

## Success metrics
- **Golden set:** all proven programs ≥90 (hard gate).
- **Eval harness pass rate:** baseline → target ≥95% across the scenario matrix.
- **Live quality:** distribution of shipped-routine scores trending up release over release.
- **Outcome:** generated-routine 4-week adherence ≥ hand-built baseline.

## Risks & mitigations
- **Repair-loop latency/cost** → cap iterations, cache, deterministic fallback.
- **Rubric over-fitting to its own rules** → golden set + outcome feedback as external checks.
- **Taxonomy data-entry errors** → unit-test sub-muscle sums against known programs.
- **LLM ignores repair instructions** → bestOf(candidates) + template fallback guarantee a floor.
