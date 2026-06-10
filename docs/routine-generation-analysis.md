# Routine Generation — Analysis & Improvement Plan

Branch: `analysis/routine-generation` (off `feature/notes-workout-v3`)

> **⚠️ Read the verified results first.** The speculative findings below (#1–#7) were
> written from code reading. We then ran a live audit (`audit/runAudit.js`, 16 programs
> across goals × days × experience × equipment, real prompt builder + real Gemini). The
> audit **overturned the original plan**. See **"Audit results (verified)"** at the bottom —
> it supersedes the Phase 1/2/3 ordering above.

## How it works today

```
RoutineGeneratorModal (UI wizard: goal → experience → days → duration → focus/include/exclude)
   └─ aiRoutineGenerator.generateRoutineProgram(options)
        ├─ gather userProfile, workoutHistory, customExercises
        ├─ buildPrompt() → routineGeneration.prompt.ts
        │     ├─ selectTemplate() / exclusion template   (splitTemplates.ts)
        │     ├─ determineTrainingAdvancement()           (trainingAdvancement.ts)
        │     └─ strength level + top-15 history summary
        ├─ callAI()  → gemini-2.5-flash, responseMimeType json, strip fences, JSON.parse
        └─ (on any throw) generateFallbackProgram()  ← static hardcoded
   └─ validateGeneratedProgram(program)   ← RESULT DISCARDED (logs only)
   └─ convertToRoutines(program) → findExerciseByName() → saveRoutine()
```

The architecture is genuinely good: real evidence-based split templates (PPL/PHUL/PHAT/GZCLP/5-3-1), an advancement model with volume/fatigue landmarks, a sound double-progression engine. The weaknesses are almost all at the **seams** — where the AI output meets the data model, and where validation meets action.

---

## Top findings (highest leverage first)

### 1. Validation runs but nothing acts on it — the single biggest gap
`validateGeneratedProgram()` is called (modal:314) and its result is **thrown away**. There's a whole system that detects squat+deadlift-same-day, set-volume overruns, and push/pull imbalance — and when it fires, the program ships anyway. No retry, no repair, no user warning.
- **Fix:** if validation produces errors/warnings, either (a) re-prompt the model with the specific violations to self-correct (one retry), or (b) apply a deterministic repair pass, or at minimum (c) surface warnings to the user. This is the cheapest big quality win.

### 2. Generated routines start every exercise at weight 0
`convertToRoutines()` sets `currentWeight: 0` for every exercise (aiRoutineGenerator:121) and hardcodes `intensityModifier: 'heavy'` for *all* of them (:108). Meanwhile `aiWorkoutGenerator` already prescribes `suggestedWeight` per exercise. So routine gen collects strength level + PR history, feeds it to the prompt to *pick* exercises, then discards it for *loading*. The user gets a great exercise list with no starting weights until they manually log set one.
- **Fix:** seed `currentWeight` from history (we have PRs + `OneRMCalculator`). Have the AI return a target intensity/%1RM or rep-range per exercise, and set `intensityModifier` per movement (heavy compound vs. light isolation) instead of blanket 'heavy'.

### 3. Silent exercise loss + risky fuzzy matching in `findExerciseByName`
If a name doesn't match, the exercise is silently dropped (:100–111) — a day can end up short or empty with zero logging. And the matcher's step 3/4 does bidirectional `includes()` (:165–179): `"Row"` matches the first exercise containing "row"; `"Deadlift"` can mis-match "Romanian Deadlift". First-match-wins with no scoring.
- **Fix:** score candidates (exact > normalized > token-overlap) and pick best; log/telemetry every unmatched name; if a day drops below the min exercise count, trigger the retry from #1.

### 4. No structured-output enforcement → brittle parsing
`callAI` sets `responseMimeType: 'application/json'` but no `responseSchema`. It then strips ```` ```json ```` fences by hand and `JSON.parse`s; any malformed shape throws → silent static fallback. Gemini supports `responseSchema` for guaranteed shape.
- **Fix:** pass a `responseSchema` matching `GeneratedRoutineProgram`. Eliminates the fence hack and most fallbacks, and lets us drop `reps: number | string` ambiguity.

### 5. Fatigue validation is unreliable because IDs don't line up
`validateGeneratedProgram` reconstructs IDs via `name.toLowerCase().replace(/[^a-z0-9]+/g,'-')` (trainingAdvancement:466) and looks them up in `EXERCISE_MOVEMENT_PATTERNS`. Anything not in that hand-maintained map defaults to `'isolation'` (:330), so real squat/hinge conflicts silently pass. Volume is also tracked by *movement pattern* as a proxy for *muscle* (:387), so chest/shoulder/tricep volume isn't actually separated.
- **Fix:** validate against real exercise IDs (we already match names in `convertToRoutines` — validate *after* matching, on the matched IDs), and pull movement pattern/primary muscles from the exercise DB instead of the partial static map.

### 6. Static fallback ignores the user's constraints
`generateFallbackProgram` emits hardcoded barbell/machine programs regardless of available equipment, `ignoredMuscles`, or `excludedExercises`. A bodyweight-only user who hits the fallback gets barbell lifts they can't do.
- **Fix:** filter fallback exercises by equipment and ignored/excluded sets, or build the fallback from the same available-exercise pool.

### 7. Programming is static — no periodization or rep ranges
Output reps are single integers (`"reps": 10`) though every template speaks in ranges (8–12). The program is one fixed week; the (good) progression engine handles week-to-week, but there's no scheduled deload/wave, and the rep-range nuance is collapsed to a point value at generation time.
- **Fix (later):** store rep ranges on `RoutineSet`; optionally add a lightweight mesocycle/deload concept.

### Smaller items
- `reps: number | string` in the generated type forces `parseInt` guesswork (:103) — drop with a schema.
- Full available-exercise list is dumped comma-joined into the prompt (token cost; exact-match burden). Consider grouping by muscle or capping smarter than the flat `100`.
- Model is hardcoded `gemini-2.5-flash`. Generation runs in the background (not latency-critical) — a stronger model or thinking budget would improve programming quality at no UX cost. (Note in-flight `feat/gemini-3.1-flash-lite` branch.)
- No verification that `includedExercises` actually appear or that day count == `weeklyDays` after generation.
- `excludedExercises` is handled only by pre-filtering the list; the SECTION 3 "MUST EXCLUDE" rule never fires because `params.excludedExercises` is never set (redundant but harmless).

---

## Recommended order of work

**Phase 1 — correctness at the seams (high value, low risk):**
1. Act on validation results (retry-on-violation, fallback to warn). [#1]
2. Robust `findExerciseByName` scoring + telemetry on drops + min-count guard. [#3]
3. `responseSchema` for guaranteed JSON shape. [#4]
4. Validate on matched IDs, not regenerated slugs. [#5]

**Phase 2 — make the program actually usable on day one:**
5. Seed starting weights from history/1RM; per-exercise intensity. [#2]
6. Equipment/exclusion-aware fallback. [#6]

**Phase 3 — programming depth:**
7. Rep ranges on sets; optional periodization/deload scheduling. [#7]
8. Prompt token/structure tuning; model/thinking choice. [smaller items]

Phase 1 is where the perceived "AI quality" problems most likely live — the model is probably producing reasonable programs that then get silently degraded (dropped exercises, ignored fatigue warnings, zero weights) on the way into the app.

---

# Audit results (verified)

**Method:** `audit/runAudit.js` — 16 programs across goals (hyp/str/pb) × days (3–6) ×
experience (beginner/intermediate/advanced) × equipment (full gym / dumbbell+bodyweight),
plus a focus cell, a no-legs exclusion cell, and an include/exclude cell. Uses the **real
compiled prompt builder**, the **verbatim** `findExerciseByName` and fatigue validator, and
**live `gemini-2.5-flash`**. Raw data in `audit/results.json` / `audit/summary.json`.

## What the data says

| Dimension | Result | Verdict |
|---|---|---|
| JSON parse success | 16/16 | Parsing never failed |
| Exercise name match rate | **100%** (0 dropped, 0 fuzzy/partial) | Matching is a non-problem in practice |
| Day count correct | 16/16 | Structure is reliable |
| Short/empty days | 0 | Exercise-count constraint respected |
| Soft "must include" honored | yes | Works |
| **Starting weights present** | **0/16** | **Every program ships at 0 lbs** |
| **Rep ranges mangled on import** | **14/16 emit ranges** | **`parseInt` truncates / breaks them** |
| Fatigue validator coverage | avg 82% (low 56% home gym) | ~18%+ of exercises invisible to it |
| Programs tripping fatigue validator | **15/16** | But mostly *by-design* — see below |
| **Hard "must exclude" honored** | **0/1** (model re-used excluded lift) | List-omission isn't enough |
| Determinism (Jaccard, 3× same input) | 0.77 | Mostly stable; ~23% varies per run |

## The original plan was wrong — here's the correction

1. **Don't rebuild deterministically, and don't build a validation-repair loop.** The LLM is
   *not* silently breaking structure — day counts, exercise validity, matching, includes, and
   parsing are all clean across 16 diverse cells. The hypothesis that motivated both a
   deterministic rewrite and a heavy validation layer is not supported by the data. Speculative
   findings **#3 (silent drops / fuzzy matching)** and **#4 (parse fragility)** essentially do
   not occur with flash on these structured inputs.

2. **The validation system is miscalibrated, not under-enforced.** 15/16 programs trip it, but
   the dominant warning is "squat + hinge same day" — which PHUL/PHAT **intentionally program**
   (lower-power day = heavy squat + heavy deadlift), while `PROGRAMMING_RULES.intermediate` sets
   `allowHeavySquatAndDeadliftSameDay: false`. **The validator contradicts the templates the same
   system ships.** Wiring it to "repair" would override proven programming and make output worse.
   The fix is to *reconcile* the rules with the templates (and raise per-muscle coverage), not to
   enforce harder. This directly refutes original finding **#1**.

3. **The real, consistent defects are all in `convertToRoutines` (the seam), not generation:**
   - **No starting weights** (0/16). We have PRs + `OneRMCalculator` and the sibling
     `aiWorkoutGenerator` already emits `suggestedWeight` — routine gen just drops it. *(orig #2 — confirmed)*
   - **Rep ranges destroyed:** model returns `"8-12"`, `"15-20"`, `"5+"` (AMRAP), even
     `"30-60 sec"`; `parseInt(String(reps))||10` turns these into `8 / 15 / 5 / 30`. The plank
     `"30-60 sec"` → **stored as 30 reps** is an outright bug. *(refines orig #7)*
   - **`intensityModifier: 'heavy'` hardcoded** for every exercise incl. isolation. *(orig #2)*
   - **Hard excludes can leak** — the model recalled `Bench Press (Barbell)` despite it being
     removed from the available list. Needs an explicit "NEVER USE" rule **and** a post-filter.
   - **Duplicate exercise entries:** PPL "Bench 4×5 + 1×5+ AMRAP" emits Bench twice → two rows
     sharing one `exerciseId` → collide in `progressionState`.

## Revised recommendation (smaller, verified)

Leave the generator alone. Fix the conversion seam + reconcile the validator:

- **A. Fix `convertToRoutines`** (highest value, ~self-contained):
  parse rep ranges into `{min,max}` (and detect time-based like `"30-60 sec"`); seed
  `currentWeight` from history/1RM; set `intensityModifier` per movement; merge duplicate
  exercise entries.
- **B. Enforce excludes**: add an explicit exclusion rule to the prompt **and** drop any
  excluded/unavailable exercise during conversion.
- **C. Reconcile the fatigue rules with the templates** (decide which wins for intermediate
  squat+hinge), and validate on **matched IDs** + DB muscles so coverage isn't 56–82%. Only
  *then* is surfacing warnings meaningful.

Not worth doing now (data doesn't justify): deterministic rewrite, validation-repair retry loop,
`responseSchema` (parsing never failed in 16/16 — keep as a cheap nice-to-have, not a priority).

## Caveats

n=16, single model (`gemini-2.5-flash`), synthetic history/profile. Parse reliability under
production volume could differ (a `responseSchema` remains cheap insurance). Determinism 0.77 is
a product call (variety vs. consistency), not a correctness issue.

---

# Item C — fatigue-rule reconciliation (done)

Two surfaces were contradicting the evidence-based templates the app ships:

1. **The prompt contradicted itself.** SECTION 2 hands the model PHUL/PHAT guidelines that
   intentionally pair heavy squat + heavy deadlift on a dedicated lower/power day, while
   SECTION 3 rule 6 said "Do NOT put heavy squat and heavy deadlift on the same day." Rewrote
   rule 6 to the frequency-based intent: that pairing may share **one** dedicated power day,
   just not repeat across multiple days (accessory hinges alongside squats are fine).

2. **The validator was miscalibrated + low-coverage.** Replaced `validateGeneratedProgram`
   (regex name→slug, unknowns default to `isolation`) with `validateRoutines`, which runs on
   the **converted routines' real exercise IDs** and is called *after* `convertToRoutines`.
   - squat+hinge now warns only when the heavy pairing repeats on **>1 day/week**.
   - the per-session muscle-volume check was **removed**: the DB labels muscles as coarse
     regions (`legs`/`back`/`arms`), so summing sets per label fires on every normal leg/back
     day. Re-scoring proved it (12/16 by-design programs). Meaningful volume validation needs
     a finer muscle taxonomy — logged as future work.

**Verified** by re-scoring the 16 captured audit programs (`audit/reverify.js`):

| Metric | Before | After |
|---|---|---|
| Exercise → real DB id coverage | ~82% (low 56%) | **100%** |
| Programs flagged by validator | **15/16** (mostly by-design) | **1/16** (genuine: heavy DL on 2 days in 6-day PPL-strength) |

Plus 5 unit tests in `lib/workout/__tests__/validateRoutines.test.ts` (single power day not
flagged; repeated pairing flagged; accessory hinge not counted heavy; keyword classification;
beginners exempt). Full suite green (14 passed, 10 opt-in integration skipped).
