import { TIER_COLORS } from '@/lib/data/strengthStandards';
import { hexAlpha, tierFoil, xpAccentForPercentile } from '@/lib/ui/tierFoil';
import { gradientForTier } from '@/lib/ui/backgroundGradients';
import { projectNextWorkoutXp } from '@/lib/gamification/levelDisplay';
import { XpLedger, WorkoutXp } from '@/lib/gamification/xp';

describe('tierFoil', () => {
  it('uses the tier gradient\'s secondary shade as the XP accent', () => {
    expect(xpAccentForPercentile(30)).toBe(gradientForTier('C').colors![1]);
    expect(xpAccentForPercentile(60)).toBe(gradientForTier('B').colors![1]);
    expect(xpAccentForPercentile(78)).toBe(gradientForTier('A').colors![1]);
    expect(xpAccentForPercentile(95)).toBe(gradientForTier('S').colors![1]);
    expect(xpAccentForPercentile(0)).toBe(gradientForTier('E').colors![1]);
  });

  it('never uses a tier hue as an XP accent', () => {
    const tierHues = new Set(Object.values(TIER_COLORS).map(c => c.toUpperCase()));
    for (const p of [0, 2, 8, 15, 30, 50, 65, 72, 80, 92, 99]) {
      expect(tierHues.has(tierFoil(p).xp.toUpperCase())).toBe(false);
    }
  });

  it('escalates rarity: sheen and edge grow with tier', () => {
    const order = [8, 30, 60, 78, 95].map(tierFoil); // D C B A S
    expect(order.map(f => f.sheen)).toEqual(['none', 'once', 'once', 'loop', 'loop']);
    for (let i = 1; i < order.length; i++) expect(order[i].edgeOpacity).toBeGreaterThan(order[i - 1].edgeOpacity);
  });

  it('treats 0 as unranked', () => {
    expect(tierFoil(0)).toMatchObject({ base: null, sheen: 'none' });
  });

  it('hexAlpha appends a clamped alpha byte', () => {
    expect(hexAlpha('#112233', 1)).toBe('#112233ff');
    expect(hexAlpha('#112233', 0)).toBe('#11223300');
    expect(hexAlpha('#112233', 2)).toBe('#112233ff');
  });
});

describe('projectNextWorkoutXp', () => {
  const w = (base: number, sets: number, prs = 0, multiplier = 1): WorkoutXp =>
    ({ workoutId: 'x', date: new Date(), base, sets, prs, prCount: 0, multiplier, weeklyGoal: 0, tierUp: 0, total: 0 });
  const ledger = (ws: WorkoutXp[]): XpLedger => ({ totalXp: 0, workouts: ws, achievementXp: 0 });

  it('falls back to a standard 18-set session with no history', () => {
    expect(projectNextWorkoutXp(ledger([]))).toBe(140);
  });

  it('uses the median of recent counted sessions, streak-boosted, rounded to 5', () => {
    const ws = [w(50, 60), w(50, 90, 40, 1.05), w(50, 75), w(0, 10)]; // last one under 3 sets: ignored
    expect(projectNextWorkoutXp(ledger(ws))).toBe(125);
  });

  it('only looks at the last N sessions', () => {
    const ws = [w(50, 150), w(50, 150), w(50, 20), w(50, 20), w(50, 20)];
    expect(projectNextWorkoutXp(ledger(ws), 3)).toBe(70);
  });
});
