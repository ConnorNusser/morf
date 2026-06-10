/**
 * Retention notification scheduler (Phase 1 — local notifications only).
 *
 * Schedules self-directed reminders (streak-at-risk, habit reminder) using
 * expo-notifications so they fire while the app is closed, with no backend.
 * Re-evaluated on each app foreground and after a workout is finished.
 *
 * Behavior is gated behind RETENTION_NOTIFICATIONS_ENABLED so this can merge
 * dark and be flipped on when ready. See docs/specs/retention-notifications.md.
 */
import * as Notifications from 'expo-notifications';
import { storageService } from '@/lib/storage/storage';
import { getStreakState, getHabitDay } from '@/lib/workout/retentionSignals';

/** Master kill-switch. Flip to true to enable Phase 1 retention reminders. */
export const RETENTION_NOTIFICATIONS_ENABLED = false;

// Anti-spam constants (see spec §7).
const WEEKLY_CAP = 3;
const EARLIEST_MINUTE = 9 * 60; // 09:00 — never schedule before this
const STREAK_DEFAULT_MINUTE = 19 * 60; // 19:00 — preferred streak-reminder slot
const HABIT_FALLBACK_MINUTE = 17 * 60 + 30; // 17:30 if no known time
const MIN_STREAK_FOR_REMINDER = 2;
const IDENTIFIER_PREFIX = 'retention:';
const META_RETENTION_DAYS = 14; // prune scheduled-day history beyond this

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  /** Cancel every reminder this service scheduled (leaves social pushes alone). */
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

  /**
   * Recompute and (re)schedule retention reminders from current state.
   * Safe to call frequently — it cancels its own prior reminders first and
   * never throws into the caller.
   */
  async refreshScheduledReminders(now: Date = new Date()): Promise<void> {
    try {
      // Always clear our prior reminders so stale ones can't linger.
      await this.cancelAll();

      if (!RETENTION_NOTIFICATIONS_ENABLED) return;

      // Only schedule if the user has already granted notification permission;
      // we don't prompt here (registration owns that).
      const perms = await Notifications.getPermissionsAsync();
      if (!perms.granted) return;

      const prefs = await storageService.getNotificationPreferences();
      if (!prefs.streakReminders && !prefs.habitReminders) return;

      // Weekly cap (spec §7): count distinct days scheduled in the trailing 7d.
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

      // Record the scheduled day for the weekly cap (deduped + pruned).
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

  /**
   * Decide which single reminder (if any) to schedule for today.
   * Priority: streak-at-risk > habit reminder (spec §7). Pure given inputs.
   */
  private planReminder(
    workouts: Parameters<typeof getStreakState>[0],
    prefs: { streakReminders: boolean; habitReminders: boolean; quietHoursEndMinute: number },
    now: Date
  ): PlannedReminder | null {
    const nowMinute = minuteOfDay(now);
    const latest = prefs.quietHoursEndMinute;

    // 1) Streak-at-risk takes priority.
    if (prefs.streakReminders) {
      const { current, trainedToday } = getStreakState(workouts, now);
      if (current >= MIN_STREAK_FOR_REMINDER && !trainedToday) {
        // Preferred 19:00; if already past, nudge ~2h out.
        let minute = STREAK_DEFAULT_MINUTE;
        if (nowMinute >= STREAK_DEFAULT_MINUTE) minute = nowMinute + 120;
        if (minute > nowMinute && minute >= EARLIEST_MINUTE && minute <= latest) {
          return {
            type: 'streak',
            fireAt: atMinute(now, minute),
            title: this.streakTitle(current),
            body: this.streakBody(current),
          };
        }
      }
    }

    // 2) Habit reminder, only on the user's usual weekday, at their usual time.
    if (prefs.habitReminders) {
      const habit = getHabitDay(workouts, now);
      const { trainedToday } = getStreakState(workouts, now);
      if (habit && habit.weekday === now.getDay() && !trainedToday) {
        const minute = Math.max(habit.medianStartMinute || HABIT_FALLBACK_MINUTE, EARLIEST_MINUTE);
        if (minute > nowMinute && minute <= latest) {
          return {
            type: 'habit',
            fireAt: atMinute(now, minute),
            title: 'Time to train 💪',
            body: 'You usually train today — your next session is ready.',
          };
        }
      }
    }

    return null;
  }

  private streakTitle(streak: number): string {
    if (streak >= 7) return `${streak}-day streak on the line`;
    return `Keep your ${streak}-day streak 🔥`;
  }

  private streakBody(streak: number): string {
    if (streak >= 7) return "You've come too far to stop now — a quick session keeps it alive.";
    if (streak >= 4) return `${streak} days strong. A quick session keeps the streak going.`;
    return "Don't break the streak — log a workout before the day ends.";
  }
}

export const retentionNotificationService = new RetentionNotificationService();
