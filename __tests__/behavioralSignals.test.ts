import { computeBehavioralSignals } from '../lib/gamification/behavioralSignals';
import { GeneratedWorkout } from '../types';

// Workout on a given Date with exercises [{ id, reps[] }].
function wk(date: Date, exercises: { id: string; reps: number[] }[] = [{ id: 'bench-press', reps: [10] }]): GeneratedWorkout {
  return {
    id: date.toISOString() + exercises.map(e => e.id).join(),
    createdAt: date,
    exercises: exercises.map(e => ({
      id: e.id,
      completedSets: e.reps.map(r => ({ reps: r, weight: 100, unit: 'lbs', completed: true })),
    })),
  } as unknown as GeneratedWorkout;
}

describe('computeBehavioralSignals', () => {
  it('returns an all-empty profile for no history', () => {
    const s = computeBehavioralSignals([]);
    expect(s.maxWorkoutsInDay).toBe(0);
    expect(s.distinctExercises).toBe(0);
    expect(s.hasWeekendPair).toBe(false);
    expect(s.trainedBefore6am).toBe(false);
    expect(s.hasAllFourSeasons).toBe(false);
  });

  it('flags time-of-day windows', () => {
    expect(computeBehavioralSignals([wk(new Date(2026, 0, 5, 5, 0))]).trainedBefore6am).toBe(true);
    expect(computeBehavioralSignals([wk(new Date(2026, 0, 5, 23, 0))]).trainedAfter10pm).toBe(true);
    const vampire = computeBehavioralSignals([wk(new Date(2026, 0, 5, 2, 0))]);
    expect(vampire.trainedMidnightTo4).toBe(true);
    expect(vampire.trainedBefore6am).toBe(true);
  });

  it('counts sessions per day and distinct exercises', () => {
    const s = computeBehavioralSignals([
      wk(new Date(2026, 0, 5, 8, 0), [{ id: 'lift-a', reps: [10] }, { id: 'lift-b', reps: [10] }]),
      wk(new Date(2026, 0, 5, 18, 0), [{ id: 'lift-c', reps: [10] }]),
    ]);
    expect(s.maxWorkoutsInDay).toBe(2);
    expect(s.distinctExercises).toBe(3);
  });

  it('detects a Saturday+Sunday weekend pair in one week', () => {
    // Jan 3 2026 is a Saturday, Jan 4 a Sunday (same Monday-start week).
    const s = computeBehavioralSignals([wk(new Date(2026, 0, 3, 9, 0)), wk(new Date(2026, 0, 4, 9, 0))]);
    expect(s.hasWeekendPair).toBe(true);
  });

  it('measures the largest comeback gap in days', () => {
    const s = computeBehavioralSignals([wk(new Date(2026, 0, 1, 9, 0)), wk(new Date(2026, 0, 21, 9, 0))]);
    expect(s.longestComebackGap).toBe(20);
  });

  it('tracks rep feats per set and per exercise-session', () => {
    const s = computeBehavioralSignals([wk(new Date(2026, 0, 5, 9, 0), [{ id: 'lift-a', reps: [20, 25] }])]);
    expect(s.maxRepsSingleSet).toBe(25);
    expect(s.maxRepsOneExerciseSession).toBe(45);
  });

  it('recognizes holiday training days', () => {
    expect(computeBehavioralSignals([wk(new Date(2026, 0, 1, 9, 0))]).trainedNewYearsDay).toBe(true);
    expect(computeBehavioralSignals([wk(new Date(2026, 11, 25, 9, 0))]).trainedChristmas).toBe(true);
    expect(computeBehavioralSignals([wk(new Date(2024, 1, 29, 9, 0))]).trainedLeapDay).toBe(true);
    // 4th Thursday of Nov 2026 = Nov 26.
    expect(computeBehavioralSignals([wk(new Date(2026, 10, 26, 9, 0))]).trainedThanksgiving).toBe(true);
  });

  it('detects push+pull+legs within a rolling 7-day window', () => {
    const within = computeBehavioralSignals([
      wk(new Date(2026, 5, 10, 9, 0), [{ id: 'push-up-bodyweight', reps: [10] }]),
      wk(new Date(2026, 5, 12, 9, 0), [{ id: 'pull-up-bodyweight', reps: [10] }]),
      wk(new Date(2026, 5, 15, 9, 0), [{ id: 'squat-bodyweight', reps: [10] }]),
    ]);
    expect(within.hasFullPPLWeek).toBe(true);

    // Legs lands >7 days after push → the window never covers all three.
    const spread = computeBehavioralSignals([
      wk(new Date(2026, 5, 10, 9, 0), [{ id: 'push-up-bodyweight', reps: [10] }]),
      wk(new Date(2026, 5, 12, 9, 0), [{ id: 'pull-up-bodyweight', reps: [10] }]),
      wk(new Date(2026, 5, 25, 9, 0), [{ id: 'squat-bodyweight', reps: [10] }]),
    ]);
    expect(spread.hasFullPPLWeek).toBe(false);
  });

  it('detects training across all four seasons of a year', () => {
    const s = computeBehavioralSignals([
      wk(new Date(2026, 0, 10, 9, 0)), // winter
      wk(new Date(2026, 3, 10, 9, 0)), // spring
      wk(new Date(2026, 6, 10, 9, 0)), // summer
      wk(new Date(2026, 9, 10, 9, 0)), // fall
    ]);
    expect(s.hasAllFourSeasons).toBe(true);
  });
});
