import { GeneratedWorkout } from '../types';
import {
  buildRewardSnapshot,
  computeSessionRewards,
  formatPRDelta,
  RewardContext,
} from '../lib/gamification/sessionRewards';

// A workout on `date` with completed sets of a given main lift.
function workout(
  date: Date,
  exerciseId: string,
  sets: { weight: number; reps: number }[],
): GeneratedWorkout {
  return {
    id: date.toISOString(),
    title: 'w',
    exercises: [
      {
        id: exerciseId,
        sets: sets.length,
        reps: '',
        isCompleted: true,
        completedSets: sets.map((s, i) => ({
          setNumber: i + 1,
          weight: s.weight,
          reps: s.reps,
          unit: 'lbs',
          completed: true,
        })),
      },
    ],
    createdAt: date,
  } as unknown as GeneratedWorkout;
}

const NOW = new Date(2026, 5, 10, 20, 0, 0); // Wed Jun 10 2026
const CTX: RewardContext = { unit: 'lbs', overall: 0, bodyWeightLbs: 180, now: NOW };
const snap = (history: GeneratedWorkout[]) => buildRewardSnapshot(history, CTX);

describe('sessionRewards', () => {
  it('reports no rewards when nothing changed', () => {
    const history = [workout(NOW, 'bench-press-barbell', [{ weight: 135, reps: 5 }])];
    const r = computeSessionRewards(snap(history), snap(history));
    expect(r.hasRewards).toBe(false);
    expect(r.newAchievements).toHaveLength(0);
    expect(r.newPRs).toHaveLength(0);
  });

  it('awards the first session: first-workout achievement and a new PR', () => {
    const before = snap([]);
    const after = snap([workout(NOW, 'bench-press-barbell', [{ weight: 185, reps: 3 }])]);
    const r = computeSessionRewards(before, after);

    expect(r.hasRewards).toBe(true);
    expect(r.newAchievements.map(a => a.id)).toContain('first-workout');
    expect(r.newPRs).toHaveLength(1);
    expect(r.newPRs[0].lift.exerciseId).toBe('bench-press-barbell');
    expect(r.newPRs[0].previous).toBeNull();
  });

  it('detects a PR only when the estimated 1RM beats the prior best', () => {
    const prior = [workout(new Date(2026, 5, 1), 'bench-press-barbell', [{ weight: 185, reps: 3 }])];
    const heavier = [...prior, workout(NOW, 'bench-press-barbell', [{ weight: 225, reps: 2 }])];
    const lighter = [...prior, workout(NOW, 'bench-press-barbell', [{ weight: 95, reps: 5 }])];

    const beat = computeSessionRewards(snap(prior), snap(heavier));
    expect(beat.newPRs).toHaveLength(1);
    expect(beat.newPRs[0].previous).not.toBeNull();
    expect(formatPRDelta(beat.newPRs[0])).toMatch(/^\+\d+ lbs$/);

    const noBeat = computeSessionRewards(snap(prior), snap(lighter));
    expect(noBeat.newPRs).toHaveLength(0);
  });

  it('formatPRDelta labels a first-ever lift as a new PR', () => {
    expect(formatPRDelta({ lift: { unit: 'lbs', estimatedOneRM: 200 } as never, previous: null })).toBe('New PR');
  });
});
