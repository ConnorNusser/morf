import { computeLast14Days, delta, WINDOW_DAYS } from '@/lib/history/last14Days';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { LoggedWorkout } from '@/types';

type Ex = { id: string; weight: number; reps: number; sets?: number; warmups?: number };

// Fixed local "now": Thu Nov 26 2026, 18:00.
const NOW = new Date(2026, 10, 26, 18, 0, 0);

function workout(id: string, daysAgo: number, exs: Ex[]): LoggedWorkout {
  const createdAt = new Date(2026, 10, 26 - daysAgo, 12, 0, 0);
  return {
    id,
    title: `W ${id}`,
    description: '',
    estimatedDuration: 45,
    difficulty: 'moderate',
    createdAt,
    exercises: exs.map(({ id: exId, weight, reps, sets = 3, warmups = 0 }) => ({
      id: exId,
      sets: sets + warmups,
      reps: String(reps),
      isCompleted: true,
      completedSets: [
        ...Array.from({ length: warmups }, (_, i) => ({
          setNumber: i + 1, weight: Math.round(weight / 2), reps, unit: 'lbs' as const, completed: true, isWarmup: true,
        })),
        ...Array.from({ length: sets }, (_, i) => ({
          setNumber: warmups + i + 1, weight, reps, unit: 'lbs' as const, completed: true, isWarmup: false,
        })),
      ],
    })),
  } as unknown as LoggedWorkout;
}

describe('delta', () => {
  it('reports signed % against the previous window, null without a baseline', () => {
    expect(delta(6, 4).pct).toBe(50);
    expect(delta(2, 4).pct).toBe(-50);
    expect(delta(3, 0).pct).toBeNull();
  });
});

describe('computeLast14Days', () => {
  it('windows today and the 13 days before; older sessions count as the previous window', () => {
    const r = computeLast14Days([
      workout('today', 0, [{ id: 'bench-press-barbell', weight: 185, reps: 5 }]),
      workout('edge', 13, [{ id: 'squat-barbell', weight: 225, reps: 5 }]),
      workout('prev', 14, [{ id: 'squat-barbell', weight: 215, reps: 5 }]),
      workout('old', 28, [{ id: 'squat-barbell', weight: 205, reps: 5 }]),
    ], NOW);

    expect(r.days).toHaveLength(WINDOW_DAYS);
    expect(r.days[WINDOW_DAYS - 1]).toEqual(new Date(2026, 10, 26));
    expect(r.sessions).toEqual({ current: 2, previous: 1, pct: 100 });
    expect(r.sessionsByDay[0]).toBe(1);
    expect(r.sessionsByDay[WINDOW_DAYS - 1]).toBe(1);
    expect(r.activeDays).toBe(2);
  });

  it('totals volume and sets, with per-day volume aligned to days', () => {
    const r = computeLast14Days([
      workout('a', 1, [{ id: 'bench-press-barbell', weight: 100, reps: 10, sets: 2 }]),
      workout('b', 20, [{ id: 'bench-press-barbell', weight: 100, reps: 10, sets: 1 }]),
    ], NOW);

    expect(r.volumeLbs.current).toBe(2000);
    expect(r.volumeLbs.previous).toBe(1000);
    expect(r.volumeLbs.pct).toBe(100);
    expect(r.sets.current).toBe(2);
    expect(r.volumeByDay[WINDOW_DAYS - 2]).toBe(2000);
    expect(r.reps).toBe(20);
  });

  it('ignores warmups for reps, split and top lift', () => {
    const r = computeLast14Days([
      workout('a', 0, [{ id: 'squat-barbell', weight: 225, reps: 5, sets: 3, warmups: 2 }]),
    ], NOW);
    expect(r.reps).toBe(15);
    expect(r.split).toEqual({ push: 0, pull: 0, legs: 3 });
    expect(r.topLift).toMatchObject({ exerciseId: 'squat-barbell', sets: 3 });
  });

  it('flags PRs against all earlier history, counting first-ever lifts with zero gain', () => {
    const r = computeLast14Days([
      workout('before', 30, [{ id: 'bench-press-barbell', weight: 185, reps: 5 }]),
      workout('now', 2, [
        { id: 'bench-press-barbell', weight: 205, reps: 5 },
        { id: 'deadlift-barbell', weight: 315, reps: 3 },
      ]),
    ], NOW);

    const bench = r.prs.find(p => p.exerciseId === 'bench-press-barbell')!;
    expect(bench.gainLbs).toBe(Math.round(e1rmLbs(205, 5, 'lbs') - e1rmLbs(185, 5, 'lbs')));
    expect(bench.name).toBe('Bench Press');
    const dl = r.prs.find(p => p.exerciseId === 'deadlift-barbell')!;
    expect(dl.gainLbs).toBe(0);
    expect(r.prs[0].exerciseId).toBe('bench-press-barbell'); // biggest gain first
  });

  it('does not flag a lift that stayed below its earlier best', () => {
    const r = computeLast14Days([
      workout('before', 30, [{ id: 'bench-press-barbell', weight: 225, reps: 5 }]),
      workout('now', 2, [{ id: 'bench-press-barbell', weight: 185, reps: 5 }]),
    ], NOW);
    expect(r.prs).toEqual([]);
  });

  it('is empty but well-formed with no recent history', () => {
    const r = computeLast14Days([], NOW);
    expect(r.sessions).toEqual({ current: 0, previous: 0, pct: null });
    expect(r.sessionsByDay.every(n => n === 0)).toBe(true);
    expect(r.topLift).toBeNull();
    expect(r.prs).toEqual([]);
  });
});
