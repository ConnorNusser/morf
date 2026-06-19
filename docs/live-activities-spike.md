# Live Activities spike — what's scaffolded & how to run it

Decision: **`@bacons/apple-targets`** (own the Widget target) — the Software Mansion library is
templated (no custom SwiftUI / App Intents) and deprecated. See
[`live-activities-evaluation.md`](./live-activities-evaluation.md).

## What's in the tree now

**JS / config (typechecked, runs today as a no-op until built):**
- `app.json` — adds the `@bacons/apple-targets` plugin, `NSSupportsLiveActivities`, and the
  `group.com.vanquil.morfai` App Group entitlement.
- `lib/liveActivity/types.ts` — content + snapshot + pending-action types (mirror the Swift).
- `lib/liveActivity/liveActivity.ts` — JS service; `requireOptionalNativeModule` → **no-ops in
  Expo Go / before the native build**, so nothing breaks.
- `hooks/useRestTimer.ts` — wired: `startTimer`/`addTime`/`endTimer` now start/update/end a **rest**
  Live Activity (self-ticking countdown). Accepts optional `{ workoutTitle, exerciseName, nextLabel }`.
- `package.json` — `@bacons/apple-targets@^4.0.7` (installed).

**Native (first drafts — compile on a Mac, expect a few fix-ups):**
- `modules/live-activity/` — local Expo module (`LiveActivity`): `start/update/end/saveWorkoutSnapshot/pullPendingActions`.
- `targets/morfwidget/` — the Widget extension:
  - `expo-target.config.js` — widget target, frameworks, App Group.
  - `Shared/MorfLiveActivityAttributes.swift` — the activity shape (the **one** source of truth).
  - `Shared/AppGroupStore.swift` — App-Group read/write + `completeAndAdvance` (next not-done set).
  - `MorfWidgetLiveActivity.swift` — Lock Screen + Dynamic Island UI (rest countdown / set editor).
  - `Intents.swift` — `AdjustReps/AdjustWeight/CompleteSet` App Intents (iOS 17+).

### The one integration detail that matters
`MorfLiveActivityAttributes` + `AppGroupStore` must compile into **both** the app and the widget so
ActivityKit matches the activity type. The `Shared/` files live in the widget target; the module's
`LiveActivity.podspec` pulls the **same files** into the app via
`source_files = '*.swift', '../../../targets/morfwidget/Shared/*.swift'`. If the activity won't
start ("no matching attributes"), this sharing is the first thing to check.

## Build & run (Mac required — does NOT work in Expo Go)

```bash
cd morph-worktrees/live-activities
npm install                       # already done once; safe to re-run
npx expo prebuild -p ios --clean  # generates ios/ incl. the MorfWidget target
# Real device (Live Activities don't show in the simulator's Lock Screen well):
npx expo run:ios --device
#   …or an EAS dev-client build:  eas build --profile development --platform ios
```

You'll need to create the **App Group `group.com.vanquil.morfai`** on both the app id and the widget
id in your Apple Developer account (EAS can manage this, or do it in Xcode → Signing & Capabilities).

### Quickest proof it works
Start a workout, check a set off → `useRestTimer.startTimer(120)` fires → a countdown should appear
on the Lock Screen / Dynamic Island and tick down on its own. That validates the whole pipeline
(target builds, App Group, attributes sharing, JS→ActivityKit) before any interactive UI.

## Staged plan from here

1. **Pipeline (this spike):** rest countdown renders on device. ⬅ start here, fix Swift compile.
2. **Interactivity:** confirm the iOS 17 `Button(intent:)` taps fire `AdjustReps/CompleteSet`
   (watch the Xcode console from the widget process).
3. **Set editor wiring (JS side, not yet done):**
   - When a set becomes "active", call `startLiveActivity({ mode: 'set', set: {...} })` and
     `saveWorkoutSnapshot(orderedSets)` from the workout session.
   - On app foreground, `pullPendingActions()` and apply them to the draft (mark done / set reps /
     set weight) so JS and the Lock Screen reconcile. The "next not-done" advance already happens
     natively via `AppGroupStore.completeAndAdvance`.
4. **Polish:** Dynamic Island expanded/compact layouts, branding, haptics, end-on-finish.

## Known limits (by iOS design)
- Interactive buttons need **iOS 17+**; 16.2–16.x shows a read-only activity ("Open Morf to log").
- No text entry in a widget — reps/weight adjust via **±steppers** (±1 rep, ±5 lb / ±2.5 kg).
- App Intents run in a constrained background process — they only touch ActivityKit + the App
  Group, never JS. All "advance" logic is mirrored in Swift (`AppGroupStore`).
- Server-driven updates (push) are out of scope for v1; everything here is local/client-side.
