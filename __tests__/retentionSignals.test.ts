import { LoggedWorkout } from '../types';
import { getStreakState, getHabitDay, getDaysSinceLastWorkout } from '../lib/workout/retentionSignals';

// Minimal workout fixture — the signal helpers only read `createdAt`.
function w(date: Date): LoggedWorkout {
  return { id: date.toISOString(), title: 'test', exercises: [], createdAt: date } as unknown as LoggedWorkout;
}

// Fixed reference "now": Wednesday, June 10 2026, 20:00 local (evening — after a
// typical training session, so same-day workouts count as past, not future).
const NOW = new Date(2026, 5, 10, 20, 0, 0);
const day = (offset: number, hour = 18, minute = 0) =>
  new Date(2026, 5, 10 - offset, hour, minute, 0);

// NOW = Wed Jun 10 2026 → week of Mon Jun 8. day(offset) = Jun (10-offset):
//   day 0..2  → this week (Jun 8–10)
//   day 3..9  → last week (Jun 1–7)
//   day 10+   → two+ weeks ago
describe('getStreakState (week-based)', () => {
  it('returns zero for no workouts', () => {
    expect(getStreakState([], NOW)).toEqual({ current: 0, trainedThisWeek: false, trainedToday: false });
  });

  it('counts this week as a 1-week streak, flags trainedToday', () => {
    expect(getStreakState([w(day(0))], NOW)).toEqual({ current: 1, trainedThisWeek: true, trainedToday: true });
  });

  it('counts the week even when today is a rest day', () => {
    // trained Tuesday this week, resting Wednesday — streak intact, not today
    expect(getStreakState([w(day(1))], NOW)).toEqual({ current: 1, trainedThisWeek: true, trainedToday: false });
  });

  it('treats a rest week in progress as still alive off last week', () => {
    // nothing this week yet, trained last week → streak holds at 1
    expect(getStreakState([w(day(3))], NOW)).toEqual({ current: 1, trainedThisWeek: false, trainedToday: false });
  });

  it('counts consecutive trained weeks', () => {
    // this week (day 0) + last week (day 7) = 2-week streak
    expect(getStreakState([w(day(0)), w(day(7))], NOW)).toEqual({ current: 2, trainedThisWeek: true, trainedToday: true });
  });

  it('breaks when a full week passed with no workout', () => {
    // trained two weeks ago only; last week empty → broken
    expect(getStreakState([w(day(14))], NOW)).toEqual({ current: 0, trainedThisWeek: false, trainedToday: false });
  });

  it('stops counting at a skipped week', () => {
    // this week + two weeks ago, but last week skipped → only this week counts
    expect(getStreakState([w(day(0)), w(day(14))], NOW)).toEqual({ current: 1, trainedThisWeek: true, trainedToday: true });
  });

  it('dedupes multiple workouts within the same week', () => {
    expect(getStreakState([w(day(0)), w(day(1)), w(day(2))], NOW)).toEqual({ current: 1, trainedThisWeek: true, trainedToday: true });
  });
});

describe('getDaysSinceLastWorkout', () => {
  it('returns null when there are no workouts', () => {
    expect(getDaysSinceLastWorkout([], NOW)).toBeNull();
  });

  it('returns 0 when trained earlier today', () => {
    expect(getDaysSinceLastWorkout([w(day(0, 8))], NOW)).toBe(0);
  });

  it('counts calendar days, not 24h windows (yesterday evening → 1)', () => {
    // day(1) is the prior calendar day at 18:00; NOW is 20:00 today → 1 day.
    expect(getDaysSinceLastWorkout([w(day(1))], NOW)).toBe(1);
  });

  it('uses the most recent workout when several exist', () => {
    expect(getDaysSinceLastWorkout([w(day(20)), w(day(6)), w(day(13))], NOW)).toBe(6);
  });

  it('ignores future-dated workouts', () => {
    expect(getDaysSinceLastWorkout([w(day(-3)), w(day(7))], NOW)).toBe(7);
  });
});

describe('getHabitDay', () => {
  it('returns null with fewer than 3 same-weekday workouts', () => {
    // Two Wednesdays (offset 0 and 7)
    expect(getHabitDay([w(day(0)), w(day(7))], NOW)).toBeNull();
  });

  it('detects a stable weekday habit and its median start time', () => {
    // Three Wednesdays at 17:00, 18:00, 19:00 → weekday 3 (Wed), median 18:00
    const workouts = [w(day(0, 17)), w(day(7, 19)), w(day(14, 18))];
    const habit = getHabitDay(workouts, NOW);
    expect(habit).not.toBeNull();
    expect(habit!.weekday).toBe(new Date(2026, 5, 10).getDay()); // Wednesday
    expect(habit!.count).toBe(3);
    expect(habit!.medianStartMinute).toBe(18 * 60); // 18:00
  });

  it('ignores workouts outside the 28-day window', () => {
    // Two recent Wednesdays + one 35 days ago → only 2 in window → null
    const workouts = [w(day(0)), w(day(7)), w(day(35))];
    expect(getHabitDay(workouts, NOW)).toBeNull();
  });

  it('picks the most frequent weekday when several qualify', () => {
    // 3 Wednesdays + 4 Mondays → Monday wins
    const wednesdays = [w(day(0)), w(day(7)), w(day(14))];
    const mondays = [w(day(2)), w(day(9)), w(day(16)), w(day(23))];
    const habit = getHabitDay([...wednesdays, ...mondays], NOW);
    expect(habit!.weekday).toBe(new Date(2026, 5, 8).getDay()); // Monday
    expect(habit!.count).toBe(4);
  });
});
