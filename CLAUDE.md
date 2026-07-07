# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Morf** (`morfai`, bundle `com.vanquil.morfai`) — an Expo / React Native fitness app: AI-generated workouts, set logging (including hands-free by voice), strength percentiles/tiers, a gamification layer (achievements, career, PRs), and a lightweight social feed. New Architecture is enabled; Hermes on both platforms; iOS has a Live Activity + Lock-Screen widget.

## Commands

```bash
npm start            # expo start (Metro; press i / a to open a simulator)
npm run ios          # expo run:ios  — required for native modules (Live Activity/widget); Expo Go can't load them
npm run android      # expo run:android
npm run web          # expo start --web (used by the visual-loop screenshot harness)

npm test             # jest — all tests
npx jest __tests__/oneRmEstimate.test.ts     # a single test file
npx jest -t "progressive overload"            # tests matching a name

npm run lint         # expo lint (eslint flat config)
npx tsc --noEmit     # typecheck
```

The **pre-commit hook** (`.husky/pre-commit`) runs `eslint --max-warnings 0`, `tsc --noEmit`, and `npm test`. All three must pass — run them before committing rather than discovering it at commit time.

Builds/releases go through EAS (`eas.json`: development / preview / production); versions use `appVersionSource: remote` (auto-increment on production).

## Testing model

Jest uses `ts-jest` in a **node** environment (`jest.config.js`) — there is no React Native / component rendering in tests. `testMatch` is `**/__tests__/**/*.test.ts` only. This is deliberate: the testable surface is the **pure domain logic** in `lib/` (parsers, calculators, progression, retention signals), not UI. When adding logic that deserves a test, keep it as a pure function in `lib/` so it's reachable without RN. `@/` maps to the repo root in both tsconfig and jest.

## Architecture

### Layers
`app/` (expo-router screens, thin) → `components/` (presentation, grouped by tab: `home/`, `history/`, `workout/`, `profile/`, `feed/`, plus shared `ui/`) → `contexts/` (global state) → `lib/` (all domain logic, the center of gravity) → `lib/services/` (Supabase, feed, notifications) & `lib/storage/` (device persistence).

### Routing & providers
`expo-router` with typed routes. Five tabs (`app/(tabs)/`): **index (Home)**, **history**, **workout** (center "+"), **notes**, **profile**. Provider nesting is set in `app/_layout.tsx`:
`GestureHandlerRootView → ThemeProvider → AlertProvider → VideoPlayerProvider → CustomExercisesProvider → WorkoutLaunchProvider → Stack`, and `app/(tabs)/_layout.tsx` adds `TabBarProvider → UserProvider` plus a custom `AnimatedTabBar`. Fonts gate the splash screen; push/retention notifications register at root and deep-link taps into tabs.

Contexts (`contexts/`): `ThemeContext` (active theme + tier level, persisted), `UserContext` (local `UserProfile`; writes local then fire-and-forget Supabase sync), `CustomExercisesContext` (user exercises CRUD), `VideoPlayerContext` (single-active `expo-video` registry), `WorkoutLaunchContext` (launch interstitial + career snapshot), `TabBarContext` (scroll-driven tab-bar opacity shared value).

### Identity — there is NO auth
There is no `supabase.auth` / login anywhere. Identity is **device-based**: `lib/services/deviceService.ts` mints a UUID in `SecureStore` (Keychain, survives reinstall). The `UserProfile` lives **locally** via `storageService` (AsyncStorage); Supabase is used **anonymously**, keyed on `device_id`, only for analytics, profile/lift sync, and the social feed. `lib/services/supabase.ts` returns `null` when `EXPO_PUBLIC_SUPABASE_URL/_KEY` are unset, and every consumer degrades gracefully — treat the backend as optional and local storage as the source of truth.

### AI generation (`lib/ai/`)
Google **Gemini** via `@google/generative-ai` (key `EXPO_PUBLIC_GEMINI_API_KEY`; models `gemini-2.5-flash` and `gemini-3.1-flash-lite`). `aiWorkoutGenerator.ts` generates/refines single workouts and custom-exercise metadata; `aiRoutineGenerator.ts` builds multi-day routines from `lib/data/programTemplates.ts`. All prompts are pure string factories in `lib/ai/prompts/*.prompt.ts` (`build…Prompt(params)`) — **edit prompts there, not inline**. Model output is fenced JSON parsed by `geminiJson.ts`. There is also a deterministic, offline path: `localWorkoutParser.ts` / `workoutNoteParser.ts` turn freeform or voice text into sets without the model — keep that path working when touching parsing.

### Domain map (`lib/`)
- `workout/` — session lifecycle & data model. `workoutDraft.ts` is the editable source-of-truth for an in-progress session; `workouts.ts` loads the exercise DB from `lib/data/exercises.json`; `progression.ts`/`progressiveOverload.ts`, `streak.ts`, `weeklyGoal.ts`, `activeRoutine.ts`, `retentionSignals.ts`.
- `gamification/` — XP/tier/achievements/PRs computed **purely from workout history** (no stored counters to keep in sync): `careerStats.ts`, `achievements.ts`, `personalRecords.ts`, `muscleMastery.ts`, `tierTimeline.ts`.
- `history/` — derived, unit-tested analytics (`sessionRecap.ts`, `liftProgress.ts`, `topMovers.ts`, `exerciseTrend.ts`).
- `data/` — static reference + calculators (`exercises.json`, `strengthStandards.ts` with `OneRMCalculator`, `programTemplates.ts`, `predictionModels.ts`).
- `services/` — `supabase.ts`, `analytics.ts` + `feedApi/feedService.ts` (backend at `feed.morf.fyi`), `notificationService.ts`/`retentionNotificationService.ts`, `voiceRecognition.ts`, `userSyncService.ts`, `geoService.ts`.
- `storage/` — `storage.ts` (`storageService`, all `STORAGE_KEYS`) and `userProfile.ts`.
- Shared types live in `types/index.ts` (`Workout`, `Routine`, `Program`, `UserProfile`, `ExerciseRecord`, tier/muscle/equipment enums). Supabase is **untyped** (no generated `Database` type) — types are hand-authored here.

### iOS Live Activity + widget
`lib/liveActivity/liveActivity.ts` is the JS bridge; it uses `requireOptionalNativeModule('LiveActivity')` so all calls **no-op in Expo Go / web / pre-build** — safe to call unconditionally. The native module is the local Expo module `modules/live-activity/` (Swift, App Group `group.com.vanquil.morfai`), and `targets/morfwidget/` is the WidgetKit extension via `@bacons/apple-targets`. Note: `targets/morfwidget/Shared/*.swift` are **intentional duplicates** of the module's `MorfLiveActivityAttributes` / `AppGroupStore` — app and widget are separate binaries matched by ActivityKit type name, so keep the two copies in sync when changing the attributes shape. Native changes require `npm run ios` (a rebuild), not just a Metro reload.

## UI conventions (enforced)
Formatting is centralized — **do not write raw `fontSize`, `color: theme.colors.text + "50"`, or literal spacing/radius**. Draw from the three-level system documented in `docs/ui-conventions.md`:
- **Tokens**: `lib/ui/typography.ts` (type scale, floor 14) + `lib/ui/tokens.ts` (ink ramp, `space`, `radius`, `tint`).
- **Text**: `components/Themed.tsx` — `<Text variant tone weight>`; StyleSheets carry **layout only** (no `fontSize`/`fontWeight`/text `color`). Use `useInk()` for icon/border/rule colors.
- **Primitives**: `components/ui/` (`SectionLabel`, `NavRow`, `EmptyState`, `Divider`, `StatStrip`, `SegmentedTabs`) — don't re-implement these inline.
Read `docs/ui-conventions.md` before touching home/history/profile presentation.

## Other docs & tooling
- `docs/` — design/spike notes: `routine-generation-analysis.md`, `live-activities-*.md`, `flat-contrast.md`, `ui-consistency-audit.md`.
- `visual-loop/` — an autonomous screenshot-and-judge harness for iterating on the History screen against `judge-spec.md` (renders the Expo-web build with Playwright, proposes candidates, pairwise-judges, applies the winner). Not part of the app build.
- `supabase/` & `supabase/migrations/` — raw SQL migrations (no `config.toml`, no local Supabase CLI workflow); apply manually against the project.

## Conventions worth knowing
- ESLint (`eslint.config.js`) intentionally allows `console`, `any`, and unused vars — those are not lint failures here; don't "fix" them for their own sake.
- Env vars are `EXPO_PUBLIC_*` (client-visible by design): `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_KEY`.
- Prefer adding new logic as a pure function in the matching `lib/` domain (testable, reusable) over embedding it in a component.
