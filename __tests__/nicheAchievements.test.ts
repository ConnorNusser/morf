import { BehavioralSignals } from '../lib/gamification/behavioralSignals';
import { computeNicheAchievements } from '../lib/gamification/nicheAchievements';

const baseSignals: BehavioralSignals = {
  trainedBefore6am: false,
  trainedAfter10pm: false,
  trainedMidnightTo4: false,
  maxWorkoutsInDay: 0,
  hasWeekendPair: false,
  longestComebackGap: 0,
  distinctExercises: 0,
  hasFullPPLWeek: false,
  maxRepsSingleSet: 0,
  maxRepsOneExerciseSession: 0,
  hasAllFourSeasons: false,
  trainedNewYearsDay: false,
  trainedThanksgiving: false,
  trainedChristmas: false,
  trainedLeapDay: false,
};

const find = (a: ReturnType<typeof computeNicheAchievements>, id: string) => a.find(x => x.id === id)!;

describe('computeNicheAchievements', () => {
  it('locks every niche badge for a blank lifter', () => {
    const a = computeNicheAchievements(baseSignals);
    expect(a.length).toBeGreaterThan(0);
    expect(a.every(x => !x.unlocked)).toBe(true);
    expect(a.every(x => x.category === 'special')).toBe(true);
  });

  it('unlocks one-shot flags from their signal', () => {
    const a = computeNicheAchievements({ ...baseSignals, trainedBefore6am: true, trainedChristmas: true });
    expect(find(a, 'early-bird').unlocked).toBe(true);
    expect(find(a, 'gym-on-christmas').unlocked).toBe(true);
    expect(find(a, 'night-owl').unlocked).toBe(false);
  });

  it('reports progress for measurable badges and unlocks at target', () => {
    const partial = computeNicheAchievements({ ...baseSignals, distinctExercises: 25 });
    expect(find(partial, 'renaissance-lifter').unlocked).toBe(false);
    expect(find(partial, 'renaissance-lifter').progress).toBeCloseTo(0.5); // 25/50

    const done = computeNicheAchievements({ ...baseSignals, maxRepsSingleSet: 35, maxWorkoutsInDay: 2 });
    expect(find(done, 'marathon-set').unlocked).toBe(true); // 35 >= 30
    expect(find(done, 'double-duty').unlocked).toBe(true); // 2 >= 2
  });
});
