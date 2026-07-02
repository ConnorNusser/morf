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
  async refreshScheduledReminders(now: Date = new Date()): Promise<void> {
    try {
      await this.cancelAll();

      if (!RETENTION_NOTIFICATIONS_ENABLED) return;

      // Don't prompt here — registration owns the permission request.
      const perms = await Notifications.getPermissionsAsync();
      if (!perms.granted) return;

      const prefs = await storageService.getNotificationPreferences();
      if (!prefs.streakReminders && !prefs.habitReminders && !prefs.comebackReminders) return;

      // Cap at WEEKLY_CAP distinct days in the trailing week.
      const meta = await storageService.getRetentionMeta();
      const todayKey = dateKey(now);
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const daysThisWeek = meta.scheduledDateKeys.filter(k => k >= dateKey(weekAgo)).length;
      const alreadyScheduledToday = meta.scheduledDateKeys.includes(todayKey);
      if (!alreadyScheduledToday && daysThisWeek >= WEEKLY_CAP) return;

      const workouts = await storageService.getWorkoutHistory();
      const reminder = this.planReminder(workouts, prefs, now);
      if (!reminder) return;

      await Notifications.scheduleNotificationAsync({
        identifier: `${IDENTIFIER_PREFIX}${todayKey}:${reminder.type}`,
        content: {
          title: reminder.title,
          body: reminder.body,
          data: { kind: 'retention', type: reminder.type, deepLink: 'notes' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
        },
      });

      if (!alreadyScheduledToday) {
        const cutoff = new Date(now);
        cutoff.setDate(cutoff.getDate() - META_RETENTION_DAYS);
        const cutoffKey = dateKey(cutoff);
        const scheduledDateKeys = [...meta.scheduledDateKeys, todayKey]
          .filter((k, i, arr) => arr.indexOf(k) === i && k >= cutoffKey)
          .sort();
        await storageService.saveRetentionMeta({ scheduledDateKeys });
      }
    } catch (error) {
      console.error('[Retention] Error refreshing reminders:', error);
    }
  }

  // At most one reminder per day, most-specific first: protect an active streak,
  // then nudge the usual training day, then win back a lapsed user.
  private planReminder(
    workouts: Parameters<typeof getStreakState>[0],
    prefs: { streakReminders: boolean; habitReminders: boolean; comebackReminders: boolean; quietHoursEndMinute: number },
    now: Date
  ): PlannedReminder | null {
    const nowMinute = minuteOfDay(now);
    const latest = prefs.quietHoursEndMinute;

    if (prefs.streakReminders) {
      const { current, trainedThisWeek } = getStreakState(workouts, now);
      // Week streaks only break when a full week passes empty, so only nudge
      // once the week is nearly over (Sat/Sun) and nothing's been logged yet.
      const fromMonday = (now.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
      const weekEnding = fromMonday >= 5;
      if (current >= MIN_STREAK_FOR_REMINDER && !trainedThisWeek && weekEnding) {
        const minute = pickFireMinute(STREAK_DEFAULT_MINUTE, nowMinute, latest);
        if (minute !== null) {
          return {
            type: 'streak',
            fireAt: atMinute(now, minute),
            title: `${current}-week streak`,
            body: current >= 4
              ? `${current} weeks strong. Get a workout in before the week's out.`
              : `Train this week so you don't lose your streak.`,
          };
        }
      }
    }

    if (prefs.habitReminders) {
      const habit = getHabitDay(workouts, now);
      const { trainedToday } = getStreakState(workouts, now);
      if (habit && habit.weekday === now.getDay() && !trainedToday) {
        const minute = Math.max(habit.medianStartMinute || HABIT_FALLBACK_MINUTE, EARLIEST_MINUTE);
        if (minute > nowMinute && minute <= latest) {
          return {
            type: 'habit',
            fireAt: atMinute(now, minute),
            title: 'Your usual training day',
            body: 'You normally train today. Pick up where you left off.',
          };
        }
      }
    }

    if (prefs.comebackReminders) {
      // The churn-risk gap: a user who started, then drifted — streak broken,
      // habit faded — gets nothing from the branches above. Nudge them back once
      // they've clearly lapsed, until they've been gone long enough to call churned.
      const days = getDaysSinceLastWorkout(workouts, now);
      if (days !== null && days >= COMEBACK_MIN_DAYS && days <= COMEBACK_MAX_DAYS) {
        const minute = pickFireMinute(COMEBACK_DEFAULT_MINUTE, nowMinute, latest);
        if (minute !== null) {
          return {
            type: 'comeback',
            fireAt: atMinute(now, minute),
            title: "Let's get back to it",
            body: `It's been ${days} days since your last workout — a quick session is all it takes to restart.`,
          };
        }
      }
    }

    return null;
  }
}

export const retentionNotificationService = new RetentionNotificationService();
