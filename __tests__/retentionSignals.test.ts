import { GeneratedWorkout } from '../types';
import { getStreakState, getHabitDay } from '../lib/workout/retentionSignals';

// Minimal workout fixture — the signal helpers only read `createdAt`.
function w(date: Date): GeneratedWorkout {
  return { id: date.toISOString(), title: 'test', exercises: [], createdAt: date } as unknown as GeneratedWorkout;
}

// Fixed reference "now": Wednesday, June 10 2026, 20:00 local (evening — after a
// typical training session, so same-day workouts count as past, not future).
const NOW = new Date(2026, 5, 10, 20, 0, 0);
const day = (offset: number, hour = 18, minute = 0) =>
  new Date(2026, 5, 10 - offset, hour, minute, 0);

describe('getStreakState', () => {
  it('returns zero for no workouts', () => {
    expect(getStreakState([], NOW)).toEqual({ current: 0, trainedToday: false });
  });

  it('counts a single workout today as streak 1 and trainedToday', () => {
    expect(getStreakState([w(day(0))], NOW)).toEqual({ current: 1, trainedToday: true });
  });

  it('counts consecutive days ending today', () => {
    const workouts = [w(day(0)), w(day(1)), w(day(2))];
    expect(getStreakState(workouts, NOW)).toEqual({ current: 3, trainedToday: true });
  });

  it('keeps the streak alive when trained yesterday but not today', () => {
    const workouts = [w(day(1)), w(day(2))];
    expect(getStreakState(workouts, NOW)).toEqual({ current: 2, trainedToday: false });
  });

  it('breaks the streak when the last workout was 2+ days ago', () => {
    expect(getStreakState([w(day(2)), w(day(3))], NOW)).toEqual({ current: 0, trainedToday: false });
  });

  it('stops counting at a gap', () => {
    // today, yesterday, then a gap (skips day 2), then day 3
    const workouts = [w(day(0)), w(day(1)), w(day(3)), w(day(4))];
    expect(getStreakState(workouts, NOW)).toEqual({ current: 2, trainedToday: true });
  });

  it('dedupes multiple workouts on the same day', () => {
    const workouts = [w(day(0, 8)), w(day(0, 19)), w(day(1))];
    expect(getStreakState(workouts, NOW)).toEqual({ current: 2, trainedToday: true });
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
