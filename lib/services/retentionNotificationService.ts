// Schedules local streak/habit reminders so the app reaches back out to solo
// users. Re-run on app foreground and after a workout. Off until the flag flips.
import * as Notifications from 'expo-notifications';
import { dateKey } from '@/lib/utils/utils';
import { storageService } from '@/lib/storage/storage';
import { getStreakState, getHabitDay } from '@/lib/workout/retentionSignals';

export const RETENTION_NOTIFICATIONS_ENABLED = true;

const WEEKLY_CAP = 3;
const EARLIEST_MINUTE = 9 * 60;
const STREAK_DEFAULT_MINUTE = 19 * 60;
const HABIT_FALLBACK_MINUTE = 17 * 60 + 30;
const MIN_STREAK_FOR_REMINDER = 2;
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

interface PlannedReminder {
  type: 'streak' | 'habit';
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
      if (!prefs.streakReminders && !prefs.habitReminders) return;

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

  // At most one reminder per day; streak-at-risk wins over the habit nudge.
  private planReminder(
    workouts: Parameters<typeof getStreakState>[0],
    prefs: { streakReminders: boolean; habitReminders: boolean; quietHoursEndMinute: number },
    now: Date
  ): PlannedReminder | null {
    const nowMinute = minuteOfDay(now);
    const latest = prefs.quietHoursEndMinute;

    if (prefs.streakReminders) {
      const { current, trainedToday } = getStreakState(workouts, now);
      if (current >= MIN_STREAK_FOR_REMINDER && !trainedToday) {
        // Prefer 7pm; if it's already past, nudge a couple hours out.
        let minute = STREAK_DEFAULT_MINUTE;
        if (nowMinute >= STREAK_DEFAULT_MINUTE) minute = nowMinute + 120;
        if (minute > nowMinute && minute >= EARLIEST_MINUTE && minute <= latest) {
          return {
            type: 'streak',
            fireAt: atMinute(now, minute),
            title: `${current}-day streak`,
            body: current >= 7
              ? `${current} days without missing. Don't let today be the first.`
              : `Get a workout in today so you don't lose it.`,
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

    return null;
  }
}

export const retentionNotificationService = new RetentionNotificationService();
