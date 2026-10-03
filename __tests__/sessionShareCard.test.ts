import {
  buildCardVariants,
  buildSharePostText,
  buildWinsLine,
  cardTitleFor,
  findLiftSpotlight,
  formatVolumeDisplay,
  pickSpotlightAchievement,
  prsFromRewards,
  shortName,
} from '@/lib/gamification/sessionShareCard';
import { e1rmLbs } from '@/lib/data/strengthStandards';
import { SessionRewards } from '@/lib/gamification/sessionRewards';
import { ParsedExercise } from '@/lib/workout/workoutTextParser';
import { UserProgress } from '@/types';

const lift = (workoutId: string, percentileRanking: number, personalRecord = 0): UserProgress => ({
  workoutId,
  personalRecord,
  lastUpdated: new Date(2026, 5, 30),
  percentileRanking,
  strengthLevel: 'B',
});

const exercise = (
  matchedExerciseId: string | undefined,
  sets: { weight: number; reps: number; unit?: 'lbs' | 'kg' }[],
  name = 'Some Lift',
): ParsedExercise => ({
  name,
  matchedExerciseId,
  isCustom: false,
  sets: sets.map((s) => ({ weight: s.weight, reps: s.reps, unit: s.unit ?? 'lbs' })),
});

describe('shortName', () => {
  it('drops a trailing equipment parenthetical', () => {
    expect(shortName('Bench Press (Barbell)')).toBe('Bench Press');
    expect(shortName('Squat')).toBe('Squat');
  });

  it('leaves a parenthetical that is not at the end', () => {
    expect(shortName('Row (Cable) Wide')).toBe('Row (Cable) Wide');
  });
});

describe('cardTitleFor', () => {
  it('keeps a real session title', () => {
    expect(cardTitleFor('  Push Day ')).toBe('Push Day');
  });

  it('swaps generated/empty titles for a day-based headline', () => {
    for (const t of ['Workout - 7/9/2026', 'workout', '', null, undefined]) {
      expect(cardTitleFor(t)).toMatch(/^\w+day workout$/);
    }
  });
});

describe('prsFromRewards', () => {
  const rewards = {
    newAchievements: [],
    hasRewards: true,
    newPRs: [
      { lift: { exerciseId: 'bench-press-barbell', name: 'Bench Press (Barbell)', estimatedOneRM: 225.4 }, previous: 215.2 },
      { lift: { exerciseId: 'squat-barbell', name: 'Squat (Barbell)', estimatedOneRM: 300 }, previous: null },
    ],
  } as unknown as SessionRewards;

  it('maps the history diff to PR rows with rounded values and percentile lookup', () => {
    expect(prsFromRewards(rewards, [lift('bench-press-barbell', 72)])).toEqual([
      {
        exerciseName: 'Bench Press (Barbell)',
        exerciseId: 'bench-press-barbell',
        newPR: 225,
        previousPR: 215,
        improvement: 10,
        percentile: 72,
      },
      {
        exerciseName: 'Squat (Barbell)',
        exerciseId: 'squat-barbell',
        newPR: 300,
        previousPR: 0,
        improvement: 0,
        percentile: undefined,
      },
    ]);
  });
});

describe('findLiftSpotlight', () => {
  it('returns null when no trained lift has a percentile', () => {
    expect(findLiftSpotlight([], [], 'lbs')).toBeNull();
    expect(
      findLiftSpotlight([exercise('bench-press-barbell', [{ weight: 200, reps: 5 }])], [lift('bench-press-barbell', 0)], 'lbs'),
    ).toBeNull();
    expect(
      findLiftSpotlight([exercise(undefined, [{ weight: 200, reps: 5 }])], [lift('bench-press-barbell', 80)], 'lbs'),
    ).toBeNull();
  });

  it('skips lifts with no weighted, non-zero-rep set', () => {
    expect(
      findLiftSpotlight(
        [exercise('bench-press-barbell', [{ weight: 0, reps: 10 }, { weight: 100, reps: 0 }])],
        [lift('bench-press-barbell', 80)],
        'lbs',
      ),
    ).toBeNull();
  });

  it('picks the highest-percentile lift and its best-e1RM set', () => {
    const spot = findLiftSpotlight(
      [
        exercise('bench-press-barbell', [{ weight: 185, reps: 5 }, { weight: 205, reps: 3 }]),
        exercise('squat-barbell', [{ weight: 225, reps: 5 }, { weight: 245, reps: 5 }]),
      ],
      [lift('bench-press-barbell', 60), lift('squat-barbell', 85)],
      'lbs',
    );
    expect(spot).toEqual({
      name: 'Squat',
      percentile: 85,
      e1rm: Math.round(e1rmLbs(245, 5, 'lbs')),
      weight: 245,
      reps: 5,
    });
  });

  it('keeps the first lift on a percentile tie', () => {
    const spot = findLiftSpotlight(
      [
        exercise('bench-press-barbell', [{ weight: 185, reps: 5 }]),
        exercise('squat-barbell', [{ weight: 225, reps: 5 }]),
      ],
      [lift('bench-press-barbell', 70), lift('squat-barbell', 70)],
      'lbs',
    );
    expect(spot?.name).toBe('Bench Press');
  });

  it('reports e1RM and top weight in the preferred unit', () => {
    const spot = findLiftSpotlight(
      [exercise('bench-press-barbell', [{ weight: 220, reps: 5 }])],
      [lift('bench-press-barbell', 70)],
      'kg',
    );
    expect(spot?.weight).toBe(100);
    expect(spot?.e1rm).toBeLessThan(e1rmLbs(220, 5, 'lbs'));
    expect(spot?.e1rm).toBeGreaterThan(100);
  });
});

describe('buildWinsLine', () => {
  it('is null when there is nothing to celebrate', () => {
    expect(buildWinsLine(0, 0)).toBeNull();
  });

  it('pluralizes PRs and achievements independently', () => {
    expect(buildWinsLine(1, 0)).toBe('1 PR unlocked');
    expect(buildWinsLine(0, 2)).toBe('2 achievements unlocked');
    expect(buildWinsLine(2, 1)).toBe('2 PRs · 1 achievement unlocked');
  });
});

describe('formatVolumeDisplay', () => {
  it('is null for missing or zero volume', () => {
    expect(formatVolumeDisplay(undefined, 'lbs')).toBeNull();
    expect(formatVolumeDisplay(0, 'lbs')).toBeNull();
  });

  it('suffixes the preferred unit and converts from lbs', () => {
    expect(formatVolumeDisplay(500, 'lbs')).toMatch(/ lbs$/);
    expect(formatVolumeDisplay(500, 'kg')).toMatch(/ kg$/);
    expect(formatVolumeDisplay(500, 'kg')).not.toBe(formatVolumeDisplay(500, 'lbs')!.replace('lbs', 'kg'));
  });
});

describe('pickSpotlightAchievement', () => {
  it('is null for an empty list', () => {
    expect(pickSpotlightAchievement([])).toBeNull();
  });

  it('picks the rarest, first one winning ties, without mutating the input', () => {
    const list = [
      { id: 'a', rarity: 'common' as const },
      { id: 'b', rarity: 'epic' as const },
      { id: 'c', rarity: 'rare' as const },
      { id: 'd', rarity: 'epic' as const },
    ];
    expect(pickSpotlightAchievement(list)?.id).toBe('b');
    expect(list.map((a) => a.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('buildCardVariants', () => {
  it('always leads with the overall card', () => {
    expect(buildCardVariants({ lift: false, prs: false, achievement: false, volume: false })).toEqual(['overall']);
  });

  it('adds the remaining layouts in a fixed order', () => {
    expect(buildCardVariants({ lift: true, prs: true, achievement: true, volume: true })).toEqual([
      'overall',
      'lift',
      'prs',
      'achievement',
      'volume',
    ]);
    expect(buildCardVariants({ lift: false, prs: true, achievement: false, volume: true })).toEqual([
      'overall',
      'prs',
      'volume',
    ]);
  });
});

describe('buildSharePostText', () => {
  const spotlight = { name: 'Bench Press', percentile: 85, e1rm: 225, weight: 205, reps: 3 };

  it('leads with the lift brag when there is one', () => {
    expect(
      buildSharePostText({ liftSpotlight: spotlight, overallTier: 'A', overallAfter: 70, volumeDisplay: '12k lbs', weightUnit: 'lbs' }),
    ).toBe('Bench Press 225 lbs 1RM today — stronger than 85% of lifters. Tracked with morf.');
  });

  it('falls back to overall standing, then volume, then a generic line', () => {
    expect(
      buildSharePostText({ liftSpotlight: null, overallTier: 'A', overallAfter: 70, volumeDisplay: '12k lbs', weightUnit: 'lbs' }),
    ).toBe('Stronger than 70% of lifters. Tracked with morf.');
    expect(
      buildSharePostText({ liftSpotlight: null, overallTier: null, overallAfter: 0, volumeDisplay: '12k lbs', weightUnit: 'lbs' }),
    ).toBe('12k lbs lifted today. Tracked with morf.');
    expect(
      buildSharePostText({ liftSpotlight: null, overallTier: null, overallAfter: 0, volumeDisplay: null, weightUnit: 'lbs' }),
    ).toBe('A lot lifted today. Tracked with morf.');
  });
});
