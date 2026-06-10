# Spec: Self-Directed Retention Notifications

**Status:** Draft · **Owner:** TBD · **Created:** 2026-06-10

## 1. Problem

Every notification Morf sends today is **social** — it only fires when *another
user* acts:

```
NotificationType = 'friend_pr' | 'friend_workout' | 'post_like' | 'post_comment'
```

All four are client-triggered (e.g. `notifyFriendsOfPR`) and pushed via the Expo
push API from `lib/services/notificationService.ts`. There is **no notification
that pulls a user back on their own** — no streak reminder, no "you got
stronger," no habit nudge.

Consequence: a user **without an active friend graph has zero re-engagement
hook**, which is most users early in their lifecycle. This is the single biggest
retention leak. The data to fix it already exists on-device — it's just never
turned into a notification.

## 2. Goal & success metric

Give every user — solo or social — a reason the app reaches back out.

**Primary metric:** D7 / D30 retention and **sessions per active week**.
**Guardrail metric:** notification opt-out rate < 5%, and per-user push volume
capped (see §7). A retention notification that drives uninstalls is a net loss.

## 3. Scope

Three notification types, phased by infra cost:

| # | Notification | Hook | Data source | Delivery | Phase |
|---|---|---|---|---|---|
| 1 | **Streak-at-risk** | loss aversion | `calculateCurrentStreak()` (on-device) | local scheduled | **1** |
| 2 | **Habit reminder** | routine | typical training day/time (on-device history) | local scheduled | **1** |
| 3 | **Weekly strength gain** | identity/status | `percentile_history` week-over-week delta | server push | **2** |

Phase 1 ships with **zero backend work**. Phase 2 needs new scheduling infra and
is gated on Phase 1 results.

## 4. Architecture decision: local vs server delivery

The deciding constraint: **these must fire while the app is closed**, and there
is **no server-side scheduler today** (morph-server is a plain Express API; no
cron / Supabase edge functions).

### Phase 1 — Local scheduled notifications (`expo-notifications`)
Use `Notifications.scheduleNotificationAsync` with a date/time trigger,
(re)scheduled on each app foreground.

- **Why it fits:** fires offline / app-closed, no backend, and the timing is
  *predictable* (streak deadline = tonight; habit = your usual training slot).
- **Timezone:** handled for free — local notifications schedule in device-local
  time, which is exactly what streak/habit reminders need. (Server-side would
  require storing each user's tz.)
- **Refresh model:** on every app foreground, cancel our previously-scheduled
  retention notifications and recompute/reschedule from current state. This
  keeps copy accurate ("5-day streak") and avoids firing a reminder after the
  user already trained.

### Phase 2 — Server-side push (deferred)
Weekly strength-gain copy is **dynamic** ("60th → 64th percentile") and the
percentile is computed server-side, so it wants a server job:
- Supabase **pg_cron + Edge Function** (preferred — no new service), OR
- `node-cron` added to morph-server.
The job queries users, computes the week-over-week `percentile_history` delta,
and batches Expo pushes to `push_tokens`. Deferred until Phase 1 proves the lever.

> A v1.5 stopgap exists for #3 without backend: schedule a **weekly local**
> notification (static copy, e.g. "Your weekly strength recap is ready") that
> deep-links into a Recap screen which renders the real delta on open. Cheaper,
> but the dynamic number in the push itself is the part that pulls — so true #3
> is Phase 2.

## 5. Detailed design — Phase 1

### 5.1 Streak-at-risk
- **Trigger condition (computed on foreground):** `currentStreak >= 2` AND no
  workout logged *today* (device-local).
- **Schedule:** a single local notification for **today at 19:00 local** (config).
  If it's already past 19:00 and no workout today, schedule for ~2h out instead
  (clamp to before 21:30; suppress if later — no late-night pings).
- **Cancel:** when a workout is completed (hook into the existing
  workout-finish flow) or on next foreground if a workout now exists for today.
- **Copy (vary by streak length):**
  - 2–3: "Keep it going — don't break your {n}-day streak 🔥"
  - 4–6: "{n} days strong. A quick session keeps the streak alive."
  - 7+: "{n}-day streak on the line. You've come too far 💪"
- **Deep link:** opens the **Notes** tab → "Up Next" routine (one-tap to train).

### 5.2 Habit reminder
- **Trigger:** user has a stable pattern (≥3 workouts on the same weekday over
  the last 4 weeks) AND hasn't trained today AND today matches that weekday.
- **Schedule:** local notification at the user's median start time for that day
  (fallback 17:30 local).
- **Suppression:** never both a habit reminder *and* a streak reminder the same
  day — streak-at-risk wins (see §7 priority).
- **Copy:** "You usually train {weekday}s — your {routineName} is ready."
- **Deep link:** Notes → "Up Next".

### 5.3 Where streak/pattern logic lives
`calculateCurrentStreak()` already exists in `lib/workout/recapStats.ts`. Add a
sibling pure helper for the weekday-pattern detection so both are unit-testable
without the notification layer:

```
lib/workout/retentionSignals.ts
  getStreakState(workouts): { current: number, trainedToday: boolean }
  getHabitDay(workouts): { weekday: number, medianStartMinute: number } | null
```

## 6. Implementation plan (Phase 1)

**New / changed files:**
- `lib/services/retentionNotificationService.ts` — orchestrates scheduling:
  `refreshScheduledReminders()` (called on app foreground), uses
  `Notifications.scheduleNotificationAsync` / `cancelScheduledNotificationAsync`.
  Tag our notifications with a known `identifier` prefix (`retention:*`) so we
  only ever cancel our own.
- `lib/workout/retentionSignals.ts` — pure streak/habit helpers (+ unit tests
  in `__tests__/retentionSignals.test.ts`).
- `app/_layout.tsx` — call `refreshScheduledReminders()` on
  `AppState` → `active` (the push-token registration already lives here, §178).
- Workout-finish flow (`hooks/useWorkoutNoteSession.ts` /
  `WorkoutFinishModal`) — call `refreshScheduledReminders()` after a completed
  workout so today's reminder is cancelled.
- **Settings UI** (Profile) — toggles for: Streak reminders, Habit reminders,
  plus a quiet-hours cutoff. Persist in local storage
  (`lib/storage/storage.ts`) + mirror to a `notification_preferences` column so
  Phase 2 server pushes can read them.

**No backend changes in Phase 1.**

**Permissions:** reuse the existing `registerForPushNotifications()` permission
grant; local notifications use the same iOS permission. If denied, no-op
silently.

## 7. Anti-spam rules (hard requirements)

- **Max 1 self-directed notification per day**, **≤ 3 per week**.
- **Priority** when multiple qualify same day: streak-at-risk > weekly gain >
  habit reminder.
- **Quiet hours:** never schedule outside 09:00–21:30 local.
- **Respect opt-out** per type; a global "pause all reminders."
- **Decay:** if the user ignores N (=5) consecutive retention pushes without
  opening, back off to weekly cadence. (Tracked locally in Phase 1.)

## 8. Edge cases
- Multiple devices: local reminders may double-fire across devices; acceptable
  for v1 (rare). Phase 2 server push dedupes by user.
- Travel / timezone change: local scheduling re-derives on next foreground.
- New user with no history: no streak/habit yet → no Phase 1 notifications
  (correctly avoids spamming day-1 users; onboarding nudges are out of scope).
- Streak computed "today or yesterday" (per `calculateCurrentStreak`): the
  at-risk reminder targets the *today* boundary so a yesterday-only streak still
  gets one save attempt.

## 9. Phasing / milestones
- **M1 (Phase 1):** streak-at-risk + habit reminder, local only, settings +
  anti-spam. Ship behind a feature flag, measure D7 lift on a cohort.
- **M2 (Phase 2):** server-side weekly strength-gain push (Supabase pg_cron +
  Edge Function reading `percentile_history`), if M1 moves retention.

## 10. Open questions
1. Default-on or default-off for streak reminders? (Recommend **default-on**,
   easy one-tap off — opt-out beats opt-in for retention, but watch the opt-out
   guardrail.)
2. Quiet-hours default cutoff — 21:30 assumed; confirm.
3. Phase 2 infra: Supabase pg_cron+Edge Function vs node-cron on morph-server?
   (Lean Supabase to avoid a new always-on service.)
4. Do we want an in-app inbox entry for these too, or push-only? (Push-only for
   v1; the `notifications` table is currently social-only.)
