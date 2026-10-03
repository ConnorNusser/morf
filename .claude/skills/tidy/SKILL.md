---
name: tidy
description: Simplify Morf code without changing behavior — collapse duplication into existing lib/ helpers, move logic out of components into pure lib/ functions, swap raw styling for tokens/primitives, delete dead code. Use when asked to simplify, clean up, tidy, or reduce code in this repo. Pass a path or "all"; defaults to the current branch's diff vs main.
---

# Tidy — behavior-preserving simplification for Morf

Goal: less code, fewer places a fact lives, same behavior. Every change must be
something a reviewer can accept without re-testing the feature by hand.

## 1. Pick the scope

- Argument is a path (`components/home`, `lib/gamification/achievements.ts`) → that.
- Argument `all` → walk `lib/`, then `components/`, then `app/`, one domain at a time.
- No argument → `git diff main...HEAD --name-only` plus uncommitted changes. If that's
  empty, say so and ask for a path.

Read `CLAUDE.md` and `docs/ui-conventions.md` first if you haven't this session.

## 2. Look for these, in priority order

1. **Duplicated domain logic.** Before keeping any calculation, grep `lib/` for an
   existing one. Known single homes — never re-derive these inline:
   - e1RM / Epley factor → `epleyFactor`, `e1rmLbs` in `lib/data/strengthStandards.ts`
   - kg↔lbs and volume → `convertWeightToLbs`, `setVolumeLbs`, `formatVolume` in `lib/utils/utils.ts`
     (math is done in lbs internally; convert only at the display edge)
   - set/duration/date formatting → `formatSet`, `formatBestSet`, `formatDuration` in
     `lib/utils/utils.ts`; relative/short/full dates in `lib/ui/formatters.ts`
   - catalog vs custom lookup → `getCatalogExercise` / `getExercise` in `lib/workout/exerciseCatalog.ts`
   - storage keys → `STORAGE_KEYS` in `lib/storage/storage.ts`
2. **Logic living in components.** Anything that computes (filters, sums, date math,
   PR detection) inside a component or hook → extract to a pure function in the matching
   `lib/` domain and add a `__tests__/*.test.ts` for it. Components should only map data to UI.
3. **Derived state stored as state.** `useState` + `useEffect` that just mirrors props
   or other state → compute it (or `useMemo`). Gamification is derived from history by
   design — never add stored counters.
4. **Raw styling.** `fontSize`, `fontWeight`, text `color`, `theme.colors.text + "50"`,
   literal spacing/radius → `<Text variant tone weight>`, `useInk()`, `space`/`radius`
   tokens. Hand-rolled section labels, rows, empty states, dividers, stat strips,
   segmented tabs → the `components/ui/` primitive.
5. **Dead code.** Unexported-and-unused functions, exports with no importers
   (`grep -rn "<name>" app components contexts lib hooks`), commented-out blocks,
   feature flags that are always one value.
6. **Over-structure.** Single-use wrappers, pass-through props, one-implementation
   abstractions, files that only re-export.

## 3. Don't touch

- `console`, `any`, unused vars — ESLint allows them on purpose; not a simplification.
- `targets/morfwidget/Shared/*.swift` vs `modules/live-activity/` duplicates — intentional.
- Prompts: only edit inside `lib/ai/prompts/*.prompt.ts`, and don't reword them as "cleanup".
- The offline parser path (`localWorkoutParser.ts` / `workoutTextParser.ts`) — simplify
  only if its tests still pass unchanged.
- Visual output. If a styling swap would change pixels (different token value), skip it
  or call it out separately — tidy is not a redesign.

## 4. Apply and verify

Make the edits directly. Keep each logical simplification separable (one commit each if
committing). Then run all three pre-commit gates:

```bash
npx eslint . --max-warnings 0 && npx tsc --noEmit && npm test
```

Fix anything you broke. If a simplification needs a behavior change to work, revert it and
list it under "Needs a decision" instead.

## 5. Report

One line per change: `file:line — what collapsed into what (−N lines)`. Then net line delta,
gate results, and any "Needs a decision" items. No preamble.
