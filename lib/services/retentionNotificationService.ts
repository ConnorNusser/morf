// Schedules local streak/habit reminders so the app reaches back out to solo
// users. Re-run on app foreground and after a workout. Off until the flag flips.
import * as Notifications from 'expo-notifications';
import { dateKey } from '@/lib/utils/utils';
import { storageService } from '@/lib/storage/storage';
import { getStreakState, getHabitDay, getDaysSinceLastWorkout } from '@/lib/workout/retentionSignals';

export const RETENTION_NOTIFICATIONS_ENABLED = true;

const WEEKLY_CAP = 3;
const EARLIEST_MINUTE = 9 * 60;
const STREAK_DEFAULT_MINUTE = 19 * 60;
const HABIT_FALLBACK_MINUTE = 17 * 60 + 30;
const COMEBACK_DEFAULT_MINUTE = 18 * 60; // 6pm — early-evening "get back to it"
const MIN_STREAK_FOR_REMINDER = 2; // weeks — only protect a streak worth keeping
// Comeback window: only nudge once they've clearly slipped (5+ days) and stop
// after ~4 weeks — past that they've churned and a local nudge won't land; that's
// a server-side win-back job's problem, not this one's.
const COMEBACK_MIN_DAYS = 5;
const COMEBACK_MAX_DAYS = 28;
const IDENTIFIER_PREFIX = 'retention:';
const META_RETENTION_DAYS = 14;


function minuteOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/** A date today at the given minute-of-day, in local time. */
function atMinute(now: Date, minute: number): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minute);
  return d;
}

// Pick the fire-minute for a reminder: prefer the default time, but if it's
// already past, push a couple hours out. Returns null when the slot isn't valid
// (in the past, before the earliest hour, or past quiet hours).
function pickFireMinute(defaultMinute: number, nowMinute: number, latest: number): number | null {
  let minute = defaultMinute;
  if (nowMinute >= defaultMinute) minute = nowMinute + 120;
  return minute > nowMinute && minute >= EARLIEST_MINUTE && minute <= latest ? minute : null;
}

interface PlannedReminder {
  type: 'streak' | 'habit' | 'comeback';
  fireAt: Date;
  title: string;
  body: string;
}

class RetentionNotificationService {
  // Only touches reminders we scheduled, never the social pushes.
  async cancelAll(): Promise<void> {
    try {
      const scheduled = await Notifications.getAllScheduledNotificationsAsync();
      await Promise.all(
        scheduled
          .filter(n => n.identifier?.startsWith(IDENTIFIER_PREFIX))
          .map(n => Notifications.cancelScheduledNotificationAsync(n.identifier))
      );
    } catch (error) {
      console.error('[Retention] Error cancelling reminders:', error);
    }
  }

  // Safe to call often — clears our prior reminders first, never throws.
  // Plans up to a week ahead: everything is cancelled and re-planned on each
  // refresh, so future reminders self-correct (train today → tomorrow's nudge
  // is re-evaluated and dropped), and a user who stops opening the app still
  // has the already-scheduled reminders waiting — the exact user this exists for.
  async refreshScheduledReminders(now: Date = new Date()): Promise<void> {
    try {
      await this.cancelAll();

      if (!RETENTION_NOTIFICATIONS_ENABLED) return;

      // Don't prompt here — registration owns the permission request.
      const perms = await Notifications.getPermissionsAsync();
      if (!perms.granted) return;

      const prefs = await storageService.getNotificationPreferences();
      if (!prefs.streakReminders && !prefs.habitReminders && !prefs.comebackReminders) return;

      const meta = await storageService.getRetentionMeta();
      const todayKey = dateKey(now);
      // Future keys belong to reminders we just cancelled — drop them and let
      // this pass re-earn them. Past/today keys stand: those days are spent.
      const spentKeys = meta.scheduledDateKeys.filter(k => k <= todayKey);

      const workouts = await storageService.getWorkoutHistory();
      const reminders = this.planReminders(workouts, prefs, now);

      // Enforce the cap per fire-day: at most WEEKLY_CAP reminder-days in the
      // trailing week of each candidate. A day already spent may be re-planned.
      const acceptedKeys: string[] = [];
      const accepted: PlannedReminder[] = [];
      for (const reminder of reminders) {
        const fireKey = dateKey(reminder.fireAt);
        const windowStart = new Date(reminder.fireAt);
        windowStart.setDate(windowStart.getDate() - 6);
        const windowStartKey = dateKey(windowStart);
        const inWindow = [...spentKeys, ...acceptedKeys].filter(
          k => k >= windowStartKey && k <= fireKey && k !== fireKey
        ).length;
        const dayAlreadySpent = spentKeys.includes(fireKey);
        if (!dayAlreadySpent && inWindow >= WEEKLY_CAP) continue;
        accepted.push(reminder);
        acceptedKeys.push(fireKey);
      }

      await Promise.all(
        accepted.map(reminder =>
          Notifications.scheduleNotificationAsync({
            identifier: `${IDENTIFIER_PREFIX}${dateKey(reminder.fireAt)}:${reminder.type}`,
            content: {
              title: reminder.title,
              body: reminder.body,
              data: { kind: 'retention', type: reminder.type, deepLink: 'notes' },
            },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: reminder.fireAt,
            },
          })
        )
      );

      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - META_RETENTION_DAYS);
      const cutoffKey = dateKey(cutoff);
      const scheduledDateKeys = [...spentKeys, ...acceptedKeys]
        .filter((k, i, arr) => arr.indexOf(k) === i && k >= cutoffKey)
        .sort();
      await storageService.saveRetentionMeta({ scheduledDateKeys });
    } catch (error) {
      console.error('[Retention] Error refreshing reminders:', error);
    }
  }

  // Plan candidate reminders up to a week out, at most one per day. Everything
  // here is a *candidate*: it fires only if the user doesn't train first, since
  // any foreground/post-workout refresh cancels and re-plans the lot. Priority
  // on a day collision: protect an active streak, then the usual training day,
  // then win back a lapsed user.
  private planReminders(
    workouts: Parameters<typeof getStreakState>[0],
    prefs: { streakReminders: boolean; habitReminders: boolean; comebackReminders: boolean; quietHoursEndMinute: number },
    now: Date
  ): PlannedReminder[] {
    const nowMinute = minuteOfDay(now);
    const latest = prefs.quietHoursEndMinute;
    const candidates: PlannedReminder[] = [];

    // A valid evening slot on a future day: the default time, pulled earlier
    // only if quiet hours start earlier.
    const futureMinute = (defaultMinute: number): number | null => {
      const minute = Math.min(defaultMinute, latest);
      return minute >= EARLIEST_MINUTE ? minute : null;
    };

    if (prefs.streakReminders) {
      const { current, shieldsAvailable, trainedThisWeek } = getStreakState(workouts, now);
      // Week streaks only break when a full week passes empty, so the nudge
      // lands when the week is nearly over: pre-planned for Saturday, or the
      // remaining slot today if the weekend has already started.
      if (current >= MIN_STREAK_FOR_REMINDER) {
        const fromMonday = (now.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
        let fireAt: Date | null = null;
        if (!trainedThisWeek) {
          if (fromMonday >= 5) {
            const minute = pickFireMinute(STREAK_DEFAULT_MINUTE, nowMinute, latest);
            if (minute !== null) fireAt = atMinute(now, minute);
          } else {
            const saturday = new Date(now);
            saturday.setDate(saturday.getDate() + (5 - fromMonday));
            const minute = futureMinute(STREAK_DEFAULT_MINUTE);
            if (minute !== null) fireAt = atMinute(saturday, minute);
          }
        } else {
          // This week is banked — pre-plan next Saturday so the post-workout
          // refresh (the most reliable one there is) protects *next* week too.
          // Still accurate at fire time: an in-progress week never shrinks
          // `current`, and training before then re-plans everything anyway.
          const nextSaturday = new Date(now);
          nextSaturday.setDate(nextSaturday.getDate() + (5 - fromMonday) + 7);
          const minute = futureMinute(STREAK_DEFAULT_MINUTE);
          if (minute !== null) fireAt = atMinute(nextSaturday, minute);
        }
        if (fireAt) {
          // Shielded users get the honest version — a miss won't break the
          // streak, so don't manufacture fake stakes. Unshielded copy names the
          // real ones: the weeks on the line and what one session preserves.
          const body = shieldsAvailable > 0
            ? `Your shield covers a miss, but week ${current + 1} only counts if you earn it.`
            : current >= 4
              ? `${current} weeks on the line — one session before Sunday keeps the run alive.`
              : `Train this week so you don't lose your streak.`;
          candidates.push({ type: 'streak', fireAt, title: `${current}-week streak`, body });
        }
      }
    }

    if (prefs.habitReminders) {
      const habit = getHabitDay(workouts, now);
      const { current, trainedToday, trainedThisWeek } = getStreakState(workouts, now);
      if (habit) {
        const minute = Math.max(habit.medianStartMinute || HABIT_FALLBACK_MINUTE, EARLIEST_MINUTE);
        if (minute <= latest) {
          // Next occurrence of their training day; today only counts while the
          // usual start time is still ahead and they haven't already trained.
          let offset = (habit.weekday - now.getDay() + 7) % 7;
          if (offset === 0 && (trainedToday || minute <= nowMinute)) offset = 7;
          const fireDay = new Date(now);
          fireDay.setDate(fireDay.getDate() + offset);
          // Tie the habit cue to a concrete payoff when one exists: securing the
          // next streak week beats a generic "you normally train today".
          const body = current >= 2 && !trainedThisWeek
            ? `Your usual day — today's session locks in week ${current + 1} of your streak.`
            : 'You normally train today. Pick up where you left off.';
          candidates.push({
            type: 'habit',
            fireAt: atMinute(fireDay, minute),
            title: 'Your usual training day',
            body,
          });
        }
      }
    }

    if (prefs.comebackReminders) {
      // The churn-risk gap: a user who started, then drifted — streak broken,
      // habit faded — gets nothing from the branches above. Pre-schedule the
      // win-back for the day their absence becomes a lapse; if they're already
      // lapsed, nudge today. Past COMEBACK_MAX_DAYS they've churned — a local
      // nudge won't land, that's a server-side job's problem.
      const days = getDaysSinceLastWorkout(workouts, now);
      if (days !== null && days <= COMEBACK_MAX_DAYS) {
        const { longest } = getStreakState(workouts, now);
        // Give the lapsed user something to chase (their own record), not
        // something to feel bad about. Guilt sells one open; a goal sells a habit.
        const bodyFor = (daysAtFire: number) => longest >= 3
          ? `Your best run is ${longest} weeks. Day one of the next one is a single session away.`
          : `It's been ${daysAtFire} days since your last workout — a quick session is all it takes to restart.`;
        // A ladder of rungs, one per week of the lapse window (+5/+12/+19/+26
        // days after the last workout) — a single nudge covers the highest
        // churn-risk month at a quarter of the density the cap allows. One
        // rung per trailing week keeps it cap-compliant by construction, and
        // any app open or workout re-plans (or clears) the whole ladder.
        for (let rung = COMEBACK_MIN_DAYS; rung <= COMEBACK_MAX_DAYS; rung += 7) {
          const delta = rung - days;
          if (delta < 0) continue;
          let fireAt: Date | null = null;
          if (delta === 0) {
            const minute = pickFireMinute(COMEBACK_DEFAULT_MINUTE, nowMinute, latest);
            if (minute !== null) fireAt = atMinute(now, minute);
          } else {
            const fireDay = new Date(now);
            fireDay.setDate(fireDay.getDate() + delta);
            const minute = futureMinute(COMEBACK_DEFAULT_MINUTE);
            if (minute !== null) fireAt = atMinute(fireDay, minute);
          }
          if (fireAt) {
            candidates.push({ type: 'comeback', fireAt, title: "Let's get back to it", body: bodyFor(rung) });
          }
        }
      }
    }

    // One reminder per day, first-listed type wins; then fire in date order.
    const byDay = new Map<string, PlannedReminder>();
    for (const c of candidates) {
      const key = dateKey(c.fireAt);
      if (!byDay.has(key)) byDay.set(key, c);
    }
    return [...byDay.values()].sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
  }
}

export const retentionNotificationService = new RetentionNotificationService();
