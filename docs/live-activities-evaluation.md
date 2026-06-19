# Live, interactive notifications — build evaluation

Goal: surface **live, interactive** notifications the user can act on without opening the app —
primarily the **rest timer** and **active workout session** on the Lock Screen + Dynamic Island,
plus actionable buttons on our existing nudges.

## 1. Two different iOS technologies (don't conflate them)

| | **Live Activities (ActivityKit)** | **Actionable notifications (UNNotificationCategory)** |
|---|---|---|
| What | A live-updating widget on the Lock Screen + Dynamic Island | Buttons on a normal banner/notification |
| Lifetime | Persistent while "live" (up to 8h, 12h stale) | Single transient alert |
| Updates | Live (self-ticking timers, local updates, or APNs push) | Static once delivered |
| Interactivity | Buttons via **App Intents** (iOS 17+) | Action buttons (iOS 10+) |
| Min iOS | 16.1 (Dynamic Island: iPhone 14 Pro+) | Any |
| Our fit | **Rest timer, active session** | Retention nudges, "rest done" |

These are independent — we can ship the actionable-notifications quick win and the Live Activity
separately.

## 2. Best-fit use cases for this app

1. **Rest-timer Live Activity** *(flagship)* — countdown on the Lock Screen / Dynamic Island with
   **+30s · Skip · Done** buttons. Maps directly to `hooks/useRestTimer.ts` (start/addTime/skip).
2. **Active-workout Live Activity** — elapsed time + current exercise/set, with **Finish set / Log
   set** actions. Maps to `useWorkoutNoteSession.ts` (`workoutStartTime`, `elapsedTime`, draft).
3. **Actionable notifications** — add buttons to today's retention nudge ("Start workout" /
   "Snooze") and a local "Rest complete" alert ("+30s" / "Done"). Builds on
   `lib/services/retentionNotificationService.ts` + `notificationService.ts` (currently passive,
   no categories/actions).

## 3. The constraint that shapes everything: how the timer stays live

A Live Activity's UI is **SwiftUI only** — it cannot be React Native. But it does **not** need a
server or push to *tick*:

- `Text(timerInterval:pauseTime:)` and `ProgressView(timerInterval:)` **count down on their own**,
  rendered by the system, with zero updates from us. → The rest timer counts down on the Lock
  Screen even with the app suspended, **no push infrastructure required**.
- We only push an explicit `update`/`end` when state *changes* (user taps +30s, skips, finishes).
  Those happen while our app is foregrounded/handling the intent, so they're **local ActivityKit
  updates** — still no APNs.

This means a **solid v1 needs no backend, no APNs, no push tokens.** Server-driven updates (e.g.
update the activity from a friend's action) would need ActivityKit push tokens later — explicitly
out of scope for v1.

## 4. Build path on our stack (Expo CNG / prebuild)

We're pure Expo prebuild — no committed `ios/`. Live Activities need a **Widget Extension target**
(a second native target), which CNG doesn't generate. Three ways to add one:

| Path | What it is | Verdict |
|---|---|---|
| **A. `@bacons/apple-targets` config plugin** | Declares the Widget Extension as an Apple target; prebuild generates it. We write the SwiftUI widget + a thin Expo module to start/update/end. | **Recommended if we want full control.** Stays in CNG, no eject. |
| **B. `software-mansion-labs/expo-live-activity`** | Maintained library wrapping ActivityKit start/update/end with a built-in timer widget + config plugin. | **Recommended for fastest solid v1** — esp. since our flagship is a timer. Evaluate how customizable the UI is before committing. |
| **C. Eject to bare RN** | Commit `ios/`, add target in Xcode. | ❌ Abandons the CNG workflow we just standardized on (we gitignored `ios/` last week). Avoid. |

Either A or B keeps prebuild. We **already have `expo-dev-client`**, so builds are ready; Live
Activities **don't work in Expo Go** — every iteration is an EAS dev-client build.

### Required config regardless of path
- `Info.plist`: `NSSupportsLiveActivities = true` (via `app.json` → `ios.infoPlist`).
- **App Group** entitlement (`group.com.vanquil.morfai`) to share timer state between app and widget.
- Interactive buttons → **App Intents** in the widget target (iOS 17+); gate gracefully on 16.1.
- Bundle id stays `com.vanquil.morfai`; widget is `com.vanquil.morfai.<widget>`.

## 5. Proposed architecture (v1, no push)

```
useRestTimer ──┐
               ├─► LiveActivity service (JS) ──► Expo module (Swift) ──► ActivityKit
useWorkout ────┘        start/update/end                                   │
                                                                           ▼
                          App Intent (Swift) ◄── tap +30s/Skip/Done ── SwiftUI widget
                                   │
                                   └─► writes shared App Group state ─► JS reconciles on resume
```

- JS owns truth; the widget self-ticks via `timerInterval` so it's accurate without updates.
- Button taps run an **App Intent** that updates the activity immediately *and* records the action
  in shared storage so the JS timer reconciles when the app next runs.

## 6. Recommended plan

- **Spike (½–1 day):** stand up `software-mansion-labs/expo-live-activity` (Path B), wire
  `useRestTimer.startTimer` → start a countdown activity, confirm it renders + self-ticks on a real
  device via dev-client build. This de-risks the whole thing fastest.
- **Decide A vs B** based on how much the SM library's widget UI can match our design. If we need
  bespoke Dynamic Island layouts / branding, move to Path A.
- **v1 scope:** rest-timer Live Activity with +30s / Skip / Done (App Intents). No backend.
- **Quick win in parallel:** add notification categories/actions to the existing retention + a new
  "rest complete" local notification — small, ships independently of the native target.
- **v2 (later):** active-session activity; ActivityKit **push** for server-driven updates.

## 7. Effort & risk

- **Effort:** v1 ≈ 2–4 days (1 spike + widget UI + intents + reconcile). Actionable notifications ≈
  half a day.
- **Risk:** mostly native/iOS (SwiftUI widget, App Group, intents, device-only testing) — none of
  it is JS. Main unknown is how much custom UI Path B allows; the spike answers that first.
- **No-regret moves:** App Group + `NSSupportsLiveActivities` + the JS LiveActivity service
  interface are needed on any path.

## Open decisions (to confirm before building)
1. **v1 surface:** rest timer only, or rest timer + active session? (Recommend: rest timer only.)
2. **UI control vs speed:** start with SM library (B) and accept its widget look, or go bespoke (A)
   from the start? (Recommend: spike B first, then decide.)
3. **Interactive buttons day one?** They need iOS 17+ App Intents; 16.1–16.x users get a
   display-only activity. OK to gate? (Recommend: yes.)
4. **Actionable notifications** — ship the quick win alongside, or focus solely on Live Activities?
