// Niche, Strava-style achievements — the surprising/quirky badges (time-of-day,
// holidays, comebacks, variety, rep feats) that delight more than the linear
// milestone ladders. All derived from BehavioralSignals, which in turn come
// purely from existing workout history. They live in the 'special' category.
import { Achievement } from './achievements';
import { BehavioralSignals } from './behavioralSignals';
import { Rarity } from './rarity';

// Compute the unlocked flag and clamped 0–1 progress from current/target once,
// so the badge builders below stay declarative.
function makeAchievement(
  base: Pick<Achievement, 'id' | 'title' | 'description' | 'icon' | 'rarity'> & { hidden?: boolean },
  current: number,
  target: number,
): Achievement {
  return {
    ...base,
    category: 'special',
    current,
    target,
    unlocked: current >= target,
    progress: Math.max(0, Math.min(1, target === 0 ? 1 : current / target)),
  };
}

// A one-shot badge: either earned or not. `hidden` marks a secret badge that the
// UI masks until it's unlocked (the joy-of-discovery pattern).
function flag(
  id: string,
  title: string,
  description: string,
  icon: string,
  rarity: Rarity,
  earned: boolean,
  hidden = false,
): Achievement {
  return makeAchievement({ id, title, description, icon, rarity, hidden }, earned ? 1 : 0, 1);
}

// A badge with measurable progress toward a threshold.
function progressBadge(
  id: string,
  title: string,
  description: string,
  icon: string,
  rarity: Rarity,
  current: number,
  target: number,
): Achievement {
  return makeAchievement({ id, title, description, icon, rarity }, current, target);
}

export function computeNicheAchievements(s: BehavioralSignals): Achievement[] {
  return [
    // Time-of-day
    flag('early-bird', 'Early Bird', 'Start a workout before 6 AM', 'partly-sunny', 'rare', s.trainedBefore6am),
    flag('night-owl', 'Night Owl', 'Finish a workout after 10 PM', 'moon', 'rare', s.trainedAfter10pm),
    flag('vampire-hours', 'Vampire Hours', 'Train between midnight and 4 AM', 'cloudy-night', 'epic', s.trainedMidnightTo4, true),
    progressBadge('double-duty', 'Double Duty', 'Log two workouts in a single day', 'copy', 'rare', s.maxWorkoutsInDay, 2),

    // Consistency patterns
    flag('weekend-warrior', 'Weekend Warrior', 'Train both Saturday and Sunday in one week', 'beer', 'common', s.hasWeekendPair),
    progressBadge('comeback-kid', 'Comeback Kid', 'Return and train after a 14-day break', 'refresh', 'rare', s.longestComebackGap, 14),
    flag('four-seasons', 'Four Seasons', 'Train in all four seasons of one year', 'leaf', 'rare', s.hasAllFourSeasons),

    // Variety & balance
    flag('well-rounded', 'Well-Rounded', 'Hit push, pull, and legs within one week', 'body', 'common', s.hasFullPPLWeek),
    flag('balanced', 'Balanced', 'Keep push and pull within 20% — 50+ sets each', 'swap-horizontal', 'rare', isBalanced(s)),
    progressBadge('renaissance-lifter', 'Renaissance Lifter', 'Log 50 different exercises', 'color-palette', 'rare', s.distinctExercises, 50),

    // Rep feats
    progressBadge('marathon-set', 'The Marathon Set', '30+ reps in a single set', 'infinite', 'rare', s.maxRepsSingleSet, 30),
    progressBadge('century-set', 'Century Set', '100+ reps of one exercise in a session', 'flame', 'epic', s.maxRepsOneExerciseSession, 100),

    // Calendar & holiday (the dated, secret-ish badges)
    flag('new-year', 'New Year, New PR', 'Train on January 1st', 'sparkles', 'rare', s.trainedNewYearsDay),
    flag('turkey-burn', 'Turkey Burn', 'Train on Thanksgiving Day', 'restaurant', 'rare', s.trainedThanksgiving),
    flag('gym-on-christmas', 'Gym on Christmas?', 'Train on December 25th', 'gift', 'epic', s.trainedChristmas, true),
    flag('leap-of-faith', 'Leap of Faith', 'Train on February 29th', 'calendar-number', 'legendary', s.trainedLeapDay, true),
  ];
}

// Push/pull within 20% of each other, once there's a real sample on both sides.
function isBalanced(s: BehavioralSignals): boolean {
  if (s.pushSets < 50 || s.pullSets < 50) return false;
  return Math.min(s.pushSets, s.pullSets) / Math.max(s.pushSets, s.pullSets) >= 0.8;
}
