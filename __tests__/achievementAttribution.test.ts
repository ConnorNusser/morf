import { attributeAchievements } from '@/lib/history/achievementAttribution';
import { GeneratedWorkout } from '@/types';

// Minimal workout factory: one exercise, `sets` completed sets of weight×reps,
// logged on the given day offset (days before 2026-06-30).
function workout(id: string, daysAgo: number, weight = 100, reps = 8, sets = 3): GeneratedWorkout {
  const createdAt = new Date(Date.UTC(2026, 5, 30) - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id,
    title: `W ${id}`,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt,
    exercises: [
      {
        id: 'bench-press-barbell',
        sets,
        reps: String(reps),
        isCompleted: true,
        completedSets: Array.from({ length: sets }, (_, i) => ({
          setNumber: i + 1,
          weight,
          reps,
          unit: 'lbs' as const,
          completed: true,
        })),
      },
    ],
    // Storage serializes createdAt as an ISO string at runtime (the app parses
    // with `new Date(...)` everywhere), so mirror that shape here.
  } as unknown as GeneratedWorkout;
}

describe('attributeAchievements', () => {
  it('pins first-workout on the first session and workouts-10 on the tenth', () => {
    // 12 workouts, one per day, oldest 12 days ago. Passed newest-first to
    // mirror the screen's sort; attribution must not care about input order.
    const history = Array.from({ length: 12 }, (_, i) => workout(`w${i + 1}`, 12 - i)).reverse();
    const map = attributeAchievements(history, 'lbs');

    expect(map['w1']?.map(a => a.id)).toContain('first-workout');
    expect(map['w10']?.map(a => a.id)).toContain('workouts-10');
    // The tenth workout must not re-earn the first-workout medal.
    expect(map['w10']?.map(a => a.id)).not.toContain('first-workout');
  });

  it('pins a 3-day streak on the third consecutive day', () => {
    const history = [workout('a', 3), workout('b', 2), workout('c', 1)];
    const map = attributeAchievements(history, 'lbs');
    expect(map['c']?.map(a => a.id)).toContain('streak-3');
    expect(map['a']?.map(a => a.id)).not.toContain('streak-3');
  });

  it('attributes each achievement exactly once', () => {
    const history = Array.from({ length: 15 }, (_, i) => workout(`w${i + 1}`, 15 - i));
    const map = attributeAchievements(history, 'lbs');
    const all = Object.values(map).flat().map(a => a.id);
    expect(new Set(all).size).toBe(all.length);
  });
});
