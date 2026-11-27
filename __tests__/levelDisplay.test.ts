import { levelForXp, totalXpForLevel } from '@/lib/gamification/levelCurve';
import {
  decideLevelIntro,
  formatXp,
  formatXpBreakdown,
  levelPillParts,
  upcomingTitle,
  xpBarSweep,
} from '@/lib/gamification/levelDisplay';
import { WorkoutXp } from '@/lib/gamification/xp';

const row = (over: Partial<WorkoutXp> = {}): WorkoutXp => ({
  workoutId: 'w',
  date: new Date(2026, 5, 1),
  base: 50,
  sets: 90,
  prs: 40,
  prCount: 1,
  multiplier: 1.05,
  weeklyGoal: 0,
  tierUp: 0,
  total: 189,
  ...over,
});

describe('formatXp', () => {
  it('groups thousands', () => {
    expect(formatXp(18240)).toBe('18,240');
    expect(formatXp(1234567)).toBe('1,234,567');
    expect(formatXp(370)).toBe('370');
    expect(formatXp(-5)).toBe('0');
  });
});

describe('levelPillParts', () => {
  it('formats "Lv N", title and "X to N+1"', () => {
    const lp = levelForXp(totalXpForLevel(23) + 10);
    const p = levelPillParts(lp);
    expect(p.levelLabel).toBe('Lv 23');
    expect(p.title).toBe('Iron');
    expect(p.toNextLabel).toBe(`${formatXp(lp.xpToNext)} to 24`);
  });
});

describe('formatXpBreakdown', () => {
  it('lists workout, sets, PR and streak', () => {
    expect(formatXpBreakdown(row())).toBe('50 workout · 90 sets · 40 PR · ×1.05 streak');
  });

  it('drops zero parts and a 1× multiplier', () => {
    expect(formatXpBreakdown(row({ prs: 0, multiplier: 1 }))).toBe('50 workout · 90 sets');
  });

  it('trims the multiplier and appends bonuses + achievement XP', () => {
    expect(formatXpBreakdown(row({ multiplier: 1.5, weeklyGoal: 100, tierUp: 150 }), 50)).toBe(
      '50 workout · 90 sets · 40 PR · ×1.5 streak · +100 goal · +150 tier up · +50 achievements',
    );
  });

  it('handles a missing workout row', () => {
    expect(formatXpBreakdown(undefined)).toBe('');
    expect(formatXpBreakdown(undefined, 25)).toBe('+25 achievements');
  });
});

describe('upcomingTitle', () => {
  it('returns the next title only when close', () => {
    expect(upcomingTitle(27)).toEqual({ minLevel: 30, title: 'Veteran' });
    expect(upcomingTitle(21)).toBeNull(); // 9 levels away
    expect(upcomingTitle(21, 10)).toEqual({ minLevel: 30, title: 'Veteran' });
    expect(upcomingTitle(60)).toBeNull(); // top title
  });
});

describe('xpBarSweep', () => {
  it('sweeps within a level', () => {
    const before = levelForXp(10);
    const after = levelForXp(100);
    expect(xpBarSweep(before, after)).toEqual({ from: before.progress, to: after.progress, wraps: false });
  });

  it('wraps when a level is crossed', () => {
    const s = xpBarSweep(levelForXp(100), levelForXp(totalXpForLevel(2) + 30));
    expect(s.wraps).toBe(true);
    expect(s.to).toBeCloseTo(30 / 190);
  });
});

describe('decideLevelIntro', () => {
  const lvl12 = levelForXp(totalXpForLevel(12) + 5);

  it('shows once for an existing user with retroactive XP', () => {
    expect(decideLevelIntro({ introSeen: false, lastSeenLevel: null }, lvl12)).toEqual({
      showIntro: true,
      markIntroSeen: false,
      syncLastSeenLevel: null,
    });
  });

  it('never shows for a brand-new user, but marks it seen', () => {
    const d = decideLevelIntro({ introSeen: false, lastSeenLevel: null }, levelForXp(0));
    expect(d.showIntro).toBe(false);
    expect(d.markIntroSeen).toBe(true);
    expect(d.syncLastSeenLevel).toBe(1);
  });

  it('skips when a level was already shown (workout finished first)', () => {
    const d = decideLevelIntro({ introSeen: false, lastSeenLevel: 12 }, lvl12);
    expect(d).toEqual({ showIntro: false, markIntroSeen: true, syncLastSeenLevel: null });
  });

  it('does not re-fire after an off-workout level-up; just advances lastSeenLevel', () => {
    const d = decideLevelIntro({ introSeen: true, lastSeenLevel: 11 }, lvl12);
    expect(d).toEqual({ showIntro: false, markIntroSeen: false, syncLastSeenLevel: 12 });
  });

  it('is a no-op when nothing changed', () => {
    const d = decideLevelIntro({ introSeen: true, lastSeenLevel: 12 }, lvl12);
    expect(d).toEqual({ showIntro: false, markIntroSeen: false, syncLastSeenLevel: null });
  });
});
