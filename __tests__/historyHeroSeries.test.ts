import { ExerciseHistoryEntry, ExerciseWithMax } from '../types';
import { buildLiftSeries, MIN_SESSIONS, N, nearestLift } from '../components/history/liftSeries';

// History is appended per SET, so a single workout produces several entries that all
// share one date. The hero must count TRAINING DAYS, not sets — otherwise one session
// fabricates a multi-point "PR progression" and reads "N sessions logged".

const entry = (weight: number, reps: number, date: Date): ExerciseHistoryEntry => ({
  weight,
  reps,
  date,
  unit: 'lbs',
});

const ex = (name: string, history: ExerciseHistoryEntry[]): ExerciseWithMax => ({
  id: name,
  name,
  maxWeight: 0,
  maxReps: 0,
  estimated1RM: 0,
  isCustom: false,
  history,
});

const DAY1 = new Date(2026, 0, 1, 10);
const DAY2 = new Date(2026, 0, 8, 10);
const DAY3 = new Date(2026, 0, 15, 10);

describe('buildLiftSeries — day-grouped gating', () => {
  it('hides the hero for a single workout logged as multiple sets', () => {
    // The "single" scenario: one session, 3 sets, all same day.
    const single = ex('Bench Press', [
      entry(135, 5, DAY1),
      entry(135, 5, DAY1),
      entry(135, 5, DAY1),
    ]);
    expect(buildLiftSeries([single], 'lbs')).toEqual([]);
  });

  it('counts distinct training days, not set count', () => {
    // 3 days × 2 sets each = 6 entries, but only 3 sessions.
    const lift = ex('Squat', [
      entry(185, 5, DAY1),
      entry(185, 5, DAY1),
      entry(205, 5, DAY2),
      entry(205, 5, DAY2),
      entry(225, 5, DAY3),
      entry(225, 5, DAY3),
    ]);
    const [series] = buildLiftSeries([lift], 'lbs');
    expect(series).toBeDefined();
    expect(series.sessions).toBe(3);
    expect(series.norm).toHaveLength(N);
    // start/end span the real window, not two identical same-day timestamps.
    expect(series.startDate.getTime()).toBe(DAY1.getTime());
    expect(series.endDate.getTime()).toBe(DAY3.getTime());
    // cumulative best rose across the window → positive all-time gain.
    expect(series.gainLbs).toBeGreaterThan(0);
  });

  it('needs at least MIN_SESSIONS distinct days to qualify', () => {
    const twoDays = ex('Deadlift', [entry(225, 3, DAY1), entry(225, 3, DAY2)]);
    expect(buildLiftSeries([twoDays], 'lbs')).toEqual([]);
    expect(MIN_SESSIONS).toBe(3);
  });
});

describe('nearestLift — actionable empty state', () => {
  it('reports the closest lift and its day count when nothing qualifies', () => {
    const single = ex('Bench Press', [entry(135, 5, DAY1), entry(135, 5, DAY1)]);
    const nearer = ex('Squat', [entry(185, 5, DAY1), entry(205, 5, DAY2)]);
    expect(nearestLift([single, nearer])).toEqual({ name: 'Squat', sessions: 2 });
  });

  it('returns null once a lift has crossed the gate', () => {
    const qualified = ex('Squat', [entry(185, 5, DAY1), entry(205, 5, DAY2), entry(225, 5, DAY3)]);
    expect(nearestLift([qualified])).toBeNull();
  });
});
