import { buildStreakMap } from '@/lib/workout/streakMap';
import { LoggedWorkout } from '@/types';

// 2026-06-01 is a Monday; "now" is Thu 2026-06-04.
const NOW = new Date(2026, 5, 4, 12);
const w = (month: number, day: number): LoggedWorkout =>
  ({ id: `${month}-${day}`, createdAt: new Date(2026, month, day, 9).toISOString(), exercises: [] }) as unknown as LoggedWorkout;

describe('buildStreakMap', () => {
  it('marks past weeks as goal / trained / missed and this week as current', () => {
    const history = [
      w(4, 18), w(4, 19), w(4, 20), // week of May 18: 3 days (goal 3 met)
      w(4, 26), // week of May 25: 1 day
      w(5, 2), // this week: 1 day
    ];
    const map = buildStreakMap(history, 3, NOW, 3, 2);
    expect(map.nodes.map(n => n.state)).toEqual(['missed', 'goal', 'trained', 'current', 'upcoming', 'upcoming']);
    expect(map.nodes.findIndex(n => n.isCurrent)).toBe(3);
    expect(map.current).toBe(3);
    expect(map.thisWeek.daysTrained).toBe(1);
    expect(map.thisWeek.trainedDays).toEqual([false, true, false, false, false, false, false]);
  });

  it('numbers the live streak through past, current and upcoming weeks', () => {
    const history = [w(4, 18), w(4, 26), w(5, 2)];
    const map = buildStreakMap(history, 3, NOW, 3, 2);
    expect(map.nodes.map(n => n.streakAt)).toEqual([null, 1, 2, 3, 4, 5]);
    expect(map.nodes.find(n => n.milestone === 4)?.state).toBe('upcoming');
    expect(map.nextMilestone).toBe(4);
    expect(map.weeksToNextMilestone).toBe(1);
  });

  it('an untrained current week still shows the streak it would extend to', () => {
    const history = [w(4, 18), w(4, 26)]; // nothing yet this week
    const map = buildStreakMap(history, 3, NOW, 2, 1);
    expect(map.current).toBe(2);
    expect(map.nodes.map(n => n.streakAt)).toEqual([1, 2, 3, 4]);
    expect(map.nodes[2].state).toBe('current');
  });

  it('handles no history', () => {
    const map = buildStreakMap([], 4, NOW, 2, 1);
    expect(map.current).toBe(0);
    expect(map.nodes.map(n => n.state)).toEqual(['missed', 'missed', 'current', 'upcoming']);
    expect(map.nodes[2].streakAt).toBe(1);
    expect(map.nextMilestone).toBe(4);
  });
});
