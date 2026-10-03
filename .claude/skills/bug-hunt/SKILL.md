---
name: bug-hunt
description: Hunt for real correctness bugs in Morf using the bug classes this codebase has actually shipped before (unit math, history-derived gamification, workout draft state, React render loops/races, week boundaries, null Supabase, AI JSON). Use when asked to find bugs, audit, or sanity-check code in this repo. Pass a path or "all"; defaults to the current branch's diff vs main. Add "fix" to also apply the confirmed fixes.
---

# Bug hunt — find bugs that would actually hit a Morf user

Output is a short list of **confirmed** bugs, not a list of style nits. A finding only counts
if you can name the input/state that produces a wrong result, crash, or stuck UI.

## 1. Pick the scope

- Argument is a path → that. `all` → `lib/` first (highest value), then `contexts/`,
  `components/workout/`, `app/`.
- No argument → `git diff main...HEAD` plus uncommitted changes; also read the callers of
  anything changed (`grep -rn "<symbol>" app components contexts lib hooks`).

Read `CLAUDE.md` first if you haven't this session.

## 2. Check these bug classes (each has bitten this repo before)

**Units & math** (#82, #83, #85)
- Weights mixed across kg and lbs. Internal math is lbs — every set must go through
  `convertWeightToLbs` / `setVolumeLbs` / `e1rmLbs` before summing or comparing.
- A second Epley/e1RM formula, or reps=0 / weight=0 / bodyweight / timed sets
  producing NaN, Infinity, or a fake PR.
- Percentile/tier math using the wrong unit or the wrong session.

**History-derived gamification** (#94, achievements replay, custom-exercise fixes)
- PRs, achievements, mastery, leagues must be derived by replaying history. Look for:
  first-time lifts not counting, custom exercises excluded (`getCatalogExercise` vs
  `getExercise` used for the wrong purpose), attribution by timestamp instead of replay,
  wrong muscle/PPL category.
- Deleting or editing a past workout — does every derived view still agree?

**Workout session state** (#37, logging/finish fixes)
- Completion derived from per-set checks in `workoutDraft.ts`, not flags.
- Pause/resume, timed sets, rest timer: elapsed time across app background/kill.
- Finish/discard paths that leave `active_note_session` or Live Activity behind.

**React behavior** (render loop, finish-modal flicker, celebration races)
- Objects/arrays built during render and passed into effect deps → loops or flicker.
- `useEffect` with async work and no cancel guard → setState after unmount, or an older
  response overwriting a newer one.
- Two triggers for one celebration/haptic/notification (double-fire races).
- Stale closures in timers, `Animated`/Reanimated callbacks, keyboard listeners.
- Screens that fetch once and never refresh on focus.

**Dates & weeks** (streaks, weekly goal, weekly league)
- Local vs UTC day boundaries, week start (Sun vs Mon), DST, workouts logged just after
  midnight, the league week rollover.

**Backend & persistence**
- `supabase` can be `null` (no env) — every consumer must degrade, not throw.
- `.single()` with no row returns an error (406) — treat as "none", not failure.
- Fire-and-forget sync that can overwrite newer local data.
- `JSON.parse` on AsyncStorage values with no schema/version guard after a shape change.
- Feed server (`feed.morf.fyi`) down → app must still work offline.

**AI path** (`lib/ai/`, `geminiJson.ts`)
- Malformed or partial model JSON, unknown exercise names, missing fields → crash
  instead of the local-parser fallback.

**Native bridge**
- `MorfLiveActivityAttributes` / `AppGroupStore` changed in `modules/live-activity/`
  but not `targets/morfwidget/Shared/` (or the reverse).

## 3. Confirm before reporting

For each candidate:
- **Pure `lib/` logic** → write a quick failing jest test in `__tests__/` that proves it.
  Keep the test if the bug is real (it becomes the regression test); delete it if it passes.
- **UI/stateful** → trace the exact sequence (state → action → wrong result) through the
  code with file:line references. If you can't trace it end to end, drop it or mark it
  "plausible" — never pad the list.

Ignore: lint-only issues, `console`/`any`/unused vars (allowed on purpose), style.

## 4. Report

Ranked most-severe first (data loss/wrong numbers shown to the user > crash > stuck UI >
cosmetic). Per bug:

```
[severity] file:line — one-sentence defect
  Repro: concrete input/state → what the user sees
  Proof: test name, or traced path
  Fix: one line
```

## 5. If invoked with "fix"

Apply fixes for confirmed bugs only, keep the regression tests, then run the pre-commit gates:

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit && npm test
```

Report what was fixed vs left, with gate results.
