import { Achievement } from '@/lib/gamification/achievements';
import { CareerStats } from '@/lib/gamification/careerStats';
import {
  buildAchievementGrid,
  cleanExerciseName,
  heatmapMonthLabels,
  heatmapRangeLabel,
  recentAchievements,
  shareStatItems,
  toSpotlight,
} from '@/lib/gamification/careerView';
import { HeatCell, TrainingHeatmap } from '@/lib/gamification/trainingHeatmap';

function ach(id: string, over: Partial<Achievement> = {}): Achievement {
  return {
    id,
    title: `T ${id}`,
    description: `D ${id}`,
    icon: 'flag',
    category: 'milestone',
    rarity: 'common',
    current: 0,
    target: 10,
    unlocked: false,
    progress: 0,
    ...over,
  };
}

function cell(y: number, m: number, d: number, over: Partial<HeatCell> = {}): HeatCell {
  return { date: new Date(y, m, d), trained: false, intensity: 0, volume: 0, future: false, split: null, ...over };
}

// Mon..Sun week starting at the given local date.
function week(y: number, m: number, d: number, futureFrom = 7): HeatCell[] {
  return Array.from({ length: 7 }, (_, i) => cell(y, m, d + i, { future: i >= futureFrom }));
}

describe('cleanExerciseName', () => {
  it('strips a trailing parenthetical', () => {
    expect(cleanExerciseName('Bench Press (Barbell)')).toBe('Bench Press');
  });
  it('leaves a plain or mid-name parenthetical alone', () => {
    expect(cleanExerciseName('Squat')).toBe('Squat');
    expect(cleanExerciseName('Row (Cable) Wide')).toBe('Row (Cable) Wide');
  });
});

describe('shareStatItems', () => {
  it('lists the six lifetime datapoints in display order', () => {
    const stats = {
      totalVolume: 12400,
      totalWorkouts: 42,
      daysActive: 40,
      longestStreak: 6,
      totalSets: 1500,
      totalReps: 9,
      unit: 'lbs',
    } as CareerStats;
    expect(shareStatItems(stats)).toEqual([
      { v: '12.4K lbs', l: 'lifted' },
      { v: '42', l: 'workouts' },
      { v: '40', l: 'days active' },
      { v: '6w', l: 'best streak' },
      { v: '1.5K', l: 'sets' },
      { v: '9', l: 'reps' },
    ]);
  });
});

describe('recentAchievements', () => {
  it('orders unlocked badges by unlock date, newest first, and drops locked ones', () => {
    const list = [
      ach('old', { unlocked: true }),
      ach('locked'),
      ach('new', { unlocked: true }),
    ];
    const out = recentAchievements(list, { old: '2026-01-01T00:00:00Z', new: '2026-06-01T00:00:00Z' });
    expect(out.map(a => a.id)).toEqual(['new', 'old']);
  });

  it('breaks date ties by how narrowly the target was cleared', () => {
    const list = [
      ach('far', { unlocked: true, current: 30, target: 10 }),
      ach('close', { unlocked: true, current: 11, target: 10 }),
    ];
    expect(recentAchievements(list, {}).map(a => a.id)).toEqual(['close', 'far']);
  });

  it('caps at six and does not mutate the input', () => {
    const list = Array.from({ length: 8 }, (_, i) => ach(`a${i}`, { unlocked: true, current: 10 + i }));
    const before = list.map(a => a.id);
    expect(recentAchievements(list, {})).toHaveLength(6);
    expect(list.map(a => a.id)).toEqual(before);
  });
});

describe('toSpotlight', () => {
  it('shows a progress label for a locked, visible achievement', () => {
    const item = toSpotlight(ach('x', { current: 1240, target: 10000, progress: 0.124 }));
    expect(item).toMatchObject({ id: 'x', title: 'T x', unlocked: false, masked: false });
    expect(item.progressLabel).toBe('1.2K / 10K · 12%');
  });
  it('omits the progress label once unlocked', () => {
    expect(toSpotlight(ach('x', { unlocked: true, progress: 1 })).progressLabel).toBeUndefined();
  });
  it('masks a secret badge that is not earned yet', () => {
    const item = toSpotlight(ach('x', { hidden: true, progress: 0.5 }));
    expect(item.masked).toBe(true);
    expect(item.title).toBe('Secret achievement');
    expect(item.progressLabel).toBeUndefined();
  });
});

describe('heatmap labels', () => {
  const heatmap: TrainingHeatmap = {
    weeks: [week(2026, 4, 18), week(2026, 4, 25), week(2026, 5, 1, 3)],
    totalDays: 0,
  };

  it('spans the first cell to the last non-future cell', () => {
    expect(heatmapRangeLabel(heatmap)).toBe('May 18 – Jun 3');
  });
  it('is empty with no weeks', () => {
    expect(heatmapRangeLabel({ weeks: [], totalDays: 0 })).toBe('');
  });
  it('labels only the first week of each month', () => {
    expect(heatmapMonthLabels(heatmap)).toEqual(['May', '', 'Jun']);
  });
});

describe('buildAchievementGrid', () => {
  const list = [
    ach('done', { unlocked: true, progress: 1 }),
    ach('doneNew', { unlocked: true, progress: 1, rarity: 'rare' }),
    ach('half', { progress: 0.5 }),
    ach('most', { progress: 0.9, category: 'strength' }),
    ach('zero'),
    ach('secret', { hidden: true, progress: 0.7 }),
  ];

  it('groups by status: closest in-progress first, newly unlocked first', () => {
    const grid = buildAchievementGrid(list, 'all', null, new Set(['doneNew']));
    expect(grid.groups.map(g => [g.key, g.label, g.items.map(a => a.id)])).toEqual([
      ['progress', 'In progress', ['most', 'half']],
      ['done', 'Completed', ['doneNew', 'done']],
      ['locked', 'Locked', ['zero', 'secret']],
    ]);
    expect(grid.unlocked).toBe(2);
    expect(grid.filtered).toHaveLength(6);
  });

  it('narrows by category, then by rarity within it', () => {
    const byCat = buildAchievementGrid(list, 'strength', null, new Set());
    expect(byCat.filtered.map(a => a.id)).toEqual(['most']);

    const byRarity = buildAchievementGrid(list, 'milestone', 'rare', new Set());
    expect(byRarity.filtered.map(a => a.id)).toEqual(['doneNew']);
    // The rarity chips keep counting the whole category, not the rarity-narrowed list.
    expect(byRarity.breakdown.find(b => b.rarity === 'common')).toEqual({ rarity: 'common', unlocked: 1, total: 4 });
    expect(byRarity.breakdown.find(b => b.rarity === 'rare')).toEqual({ rarity: 'rare', unlocked: 1, total: 1 });
  });
});
