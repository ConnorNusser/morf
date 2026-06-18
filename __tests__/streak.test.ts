import { GeneratedWorkout } from '../types';
import { getWeekStreak, weekStart } from '../lib/workout/streak';

function w(date: Date): GeneratedWorkout {
  return { id: date.toISOString(), title: 't', exercises: [], createdAt: date } as unknown as GeneratedWorkout;
}

// NOW = Wed Jun 10 2026 (week of Mon Jun 8). day(offset) = Jun (10 - offset).
const NOW = new Date(2026, 5, 10, 20, 0, 0);
const day = (offset: number) => new Date(2026, 5, 10 - offset, 18, 0, 0);

describe('weekStart', () => {
  it('snaps any weekday to its Monday at midnight', () => {
    expect(weekStart(new Date(2026, 5, 10, 20, 0)).getTime()).toBe(new Date(2026, 5, 8, 0, 0, 0, 0).getTime());
    // Sunday belongs to the week that started the prior Monday
    expect(weekStart(new Date(2026, 5, 7, 23, 0)).getTime()).toBe(new Date(2026, 5, 1, 0, 0, 0, 0).getTime());
  });
});

describe('getWeekStreak', () => {
  it('zeroes out with no workouts', () => {
    expect(getWeekStreak([], NOW)).toEqual({ current: 0, longest: 0, trainedThisWeek: false, trainedToday: false });
  });

  it('does not break the streak on a rest day within the week', () => {
    const s = getWeekStreak([w(day(2))], NOW); // Mon this week, resting since
    expect(s).toEqual({ current: 1, longest: 1, trainedThisWeek: true, trainedToday: false });
  });

  it('keeps the streak through an in-progress empty week', () => {
    // last week trained, nothing yet this week — still alive at 1
    expect(getWeekStreak([w(day(3))], NOW).current).toBe(1);
  });

  it('counts a run of consecutive weeks and reports the longest', () => {
    // this week, last week, two weeks ago — 3 in a row
    const s = getWeekStreak([w(day(0)), w(day(7)), w(day(14))], NOW);
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
  });

  it('longest can exceed current when an older run was longer', () => {
    // current run = this week only (last week skipped). Older run of 3 weeks:
    // 3, 4, 5 weeks ago (Jun 1 is day 9; older weeks via larger offsets).
    const s = getWeekStreak(
      [w(day(0)), w(day(14)), w(day(21)), w(day(28))],
      NOW,
    );
    expect(s.current).toBe(1); // last week empty broke the chain
    expect(s.longest).toBe(3); // the May run
  });
});
