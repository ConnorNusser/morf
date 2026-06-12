// Achievement / milestone engine. Pure: derives unlocked state and progress
// from career stats + overall strength percentile. No new tracking required —
// everything is computed from existing data, so it stays in sync automatically.
import { convertWeight } from '@/types';
import { CareerStats } from './careerStats';
import { Rarity, RARITY_ORDER } from './rarity';

// Single heaviest completed set, in lbs (so plate milestones are fair in kg too).
function heaviestSetLbs(s: CareerStats): number {
  if (!s.heaviestSet) return 0;
  return Math.round(s.unit === 'kg' ? convertWeight(s.heaviestSet.weight, 'kg', 'lbs') : s.heaviestSet.weight);
}

export type AchievementCategory = 'consistency' | 'volume' | 'strength' | 'milestone' | 'special';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string; // Ionicons name
  category: AchievementCategory;
  rarity: Rarity;
  current: number;
  target: number;
  unlocked: boolean;
  progress: number; // 0..1, clamped
  hidden?: boolean; // a "secret" badge — masked in the UI until earned
}

interface AchievementDef {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: AchievementCategory;
  rarity: Rarity;
  target: number;
  hidden?: boolean;
  // Current value for this metric, given the user's stats + overall percentile.
  metric: (stats: CareerStats, percentile: number) => number;
}

const DEFS: AchievementDef[] = [
  // Milestone — getting started
  { id: 'first-workout', title: 'First Rep', description: 'Log your first workout', icon: 'flag', category: 'milestone', rarity: 'common', target: 1, metric: s => s.totalWorkouts },
  { id: 'workouts-10', title: 'Getting Serious', description: 'Log 10 workouts', icon: 'barbell', category: 'milestone', rarity: 'common', target: 10, metric: s => s.totalWorkouts },
  { id: 'workouts-50', title: 'Committed', description: 'Log 50 workouts', icon: 'fitness', category: 'milestone', rarity: 'rare', target: 50, metric: s => s.totalWorkouts },
  { id: 'workouts-100', title: 'Century', description: 'Log 100 workouts', icon: 'trophy', category: 'milestone', rarity: 'rare', target: 100, metric: s => s.totalWorkouts },
  { id: 'workouts-250', title: 'Iron Devotee', description: 'Log 250 workouts', icon: 'trophy', category: 'milestone', rarity: 'epic', target: 250, metric: s => s.totalWorkouts },
  { id: 'workouts-500', title: 'Iron Legend', description: 'Log 500 workouts', icon: 'ribbon', category: 'milestone', rarity: 'legendary', target: 500, metric: s => s.totalWorkouts },

  // Consistency — streaks & active days
  { id: 'streak-3', title: 'Warming Up', description: 'Train 3 days in a row', icon: 'flame', category: 'consistency', rarity: 'common', target: 3, metric: s => s.longestStreak },
  { id: 'streak-7', title: 'Full Week', description: '7-day training streak', icon: 'flame', category: 'consistency', rarity: 'common', target: 7, metric: s => s.longestStreak },
  { id: 'streak-14', title: 'Locked In', description: '14-day training streak', icon: 'flame', category: 'consistency', rarity: 'rare', target: 14, metric: s => s.longestStreak },
  { id: 'streak-30', title: 'Unstoppable', description: '30-day training streak', icon: 'flame', category: 'consistency', rarity: 'rare', target: 30, metric: s => s.longestStreak },
  { id: 'streak-60', title: 'Iron Will', description: '60-day training streak', icon: 'flame', category: 'consistency', rarity: 'epic', target: 60, metric: s => s.longestStreak },
  { id: 'streak-100', title: 'Relentless', description: '100-day training streak', icon: 'flame', category: 'consistency', rarity: 'legendary', target: 100, metric: s => s.longestStreak },
  { id: 'member-365', title: 'Veteran', description: 'One year with Morf', icon: 'time', category: 'consistency', rarity: 'rare', target: 365, metric: s => s.daysSinceStart },
  { id: 'days-100', title: 'Regular', description: 'Train on 100 different days', icon: 'calendar', category: 'consistency', rarity: 'rare', target: 100, metric: s => s.daysActive },
  { id: 'days-365', title: 'Year of Iron', description: 'Train on 365 different days', icon: 'calendar', category: 'consistency', rarity: 'epic', target: 365, metric: s => s.daysActive },

  // Volume — total weight moved
  { id: 'volume-100k', title: 'Mover', description: 'Lift 100K total', icon: 'trending-up', category: 'volume', rarity: 'common', target: 100_000, metric: s => s.totalVolume },
  { id: 'volume-1m', title: 'Millionaire', description: 'Lift 1M total', icon: 'trending-up', category: 'volume', rarity: 'rare', target: 1_000_000, metric: s => s.totalVolume },
  { id: 'volume-5m', title: 'Tonnage', description: 'Lift 5M total', icon: 'rocket', category: 'volume', rarity: 'epic', target: 5_000_000, metric: s => s.totalVolume },
  { id: 'volume-10m', title: 'Earth Mover', description: 'Lift 10M total', icon: 'planet', category: 'volume', rarity: 'legendary', target: 10_000_000, metric: s => s.totalVolume },
  { id: 'reps-10k', title: 'Rep Machine', description: 'Complete 10,000 reps', icon: 'repeat', category: 'volume', rarity: 'rare', target: 10_000, metric: s => s.totalReps },
  { id: 'session-20k', title: 'Big Session', description: 'Move 20K in one workout', icon: 'flash', category: 'volume', rarity: 'rare', target: 20_000, metric: s => s.biggestSessionVolume },
  { id: 'reps-50k', title: 'Rep God', description: 'Complete 50,000 reps', icon: 'repeat', category: 'volume', rarity: 'epic', target: 50_000, metric: s => s.totalReps },

  // Strength — overall percentile / tier gates
  { id: 'tier-c', title: 'Above Average', description: 'Reach C tier', icon: 'shield-half', category: 'strength', rarity: 'common', target: 31, metric: (_s, p) => p },
  { id: 'tier-b', title: 'Strong', description: 'Reach B tier', icon: 'shield', category: 'strength', rarity: 'rare', target: 55, metric: (_s, p) => p },
  { id: 'tier-a', title: 'Elite', description: 'Reach A tier', icon: 'medal', category: 'strength', rarity: 'epic', target: 75, metric: (_s, p) => p },
  { id: 'tier-s', title: 'Legendary', description: 'Reach S tier', icon: 'star', category: 'strength', rarity: 'legendary', target: 90, metric: (_s, p) => p },

  // For fun — silly milestones that are a wink as much as a goal.
  { id: 'meme-9000', title: "It's Over 9,000!", description: 'Lift over 9,000 total', icon: 'flame', category: 'volume', rarity: 'common', target: 9_000, metric: s => s.totalVolume },
  { id: 'sets-1000', title: 'Glutton for Punishment', description: 'Complete 1,000 sets', icon: 'repeat', category: 'volume', rarity: 'rare', target: 1_000, metric: s => s.totalSets },
  { id: 'reps-marathon', title: 'Marathoner', description: 'Rep your way to a marathon — 26,200 reps', icon: 'walk', category: 'volume', rarity: 'epic', target: 26_200, metric: s => s.totalReps },
  { id: 'plates-1', title: 'One Plate', description: '135 lbs on a single set', icon: 'barbell', category: 'strength', rarity: 'common', target: 135, metric: heaviestSetLbs },
  { id: 'plates-2', title: 'Plate Tectonics', description: '225 lbs on a single set (two plates)', icon: 'barbell', category: 'strength', rarity: 'rare', target: 225, metric: heaviestSetLbs },
  { id: 'plates-3', title: 'Three Plate Club', description: '315 lbs on a single set', icon: 'barbell', category: 'strength', rarity: 'epic', target: 315, metric: heaviestSetLbs },
  { id: 'plates-4', title: 'Four Plate Monster', description: '405 lbs on a single set', icon: 'barbell', category: 'strength', rarity: 'epic', target: 405, metric: heaviestSetLbs },
  { id: 'plates-5', title: 'Five Plates', description: '495 lbs on a single set', icon: 'skull', category: 'strength', rarity: 'legendary', target: 495, metric: heaviestSetLbs },
  { id: 'days-200', title: 'Touch Grass', description: 'Train on 200 different days (seriously, go outside)', icon: 'leaf', category: 'consistency', rarity: 'rare', target: 200, metric: s => s.daysActive },
  { id: 'member-1000', title: 'Lifer', description: '1,000 days since your first workout', icon: 'hourglass', category: 'consistency', rarity: 'epic', target: 1_000, metric: s => s.daysSinceStart },
  { id: 'session-50k', title: 'Leg Day Regret', description: 'Move 50K in a single workout', icon: 'flash', category: 'volume', rarity: 'epic', target: 50_000, metric: s => s.biggestSessionVolume },
];

export function computeAchievements(stats: CareerStats, overallPercentile: number): Achievement[] {
  return DEFS.map(def => {
    const current = def.metric(stats, overallPercentile);
    const unlocked = current >= def.target;
    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      category: def.category,
      rarity: def.rarity,
      current,
      target: def.target,
      unlocked,
      progress: Math.max(0, Math.min(1, def.target === 0 ? 1 : current / def.target)),
      hidden: def.hidden,
    };
  });
}

export interface AchievementSummary {
  unlockedCount: number;
  total: number;
  // The closest-to-complete locked achievement — the "next goal" to chase.
  nextUp: Achievement | null;
}

// IDs of currently-unlocked achievements.
export function unlockedIds(achievements: Achievement[]): string[] {
  return achievements.filter(a => a.unlocked).map(a => a.id);
}

// Unlocked achievements the user hasn't acknowledged yet (for "NEW" highlights).
export function newlyUnlocked(achievements: Achievement[], seenIds: string[]): Achievement[] {
  const seen = new Set(seenIds);
  return achievements.filter(a => a.unlocked && !seen.has(a.id));
}

// Display fields for an achievement, masking secret badges that aren't earned yet
// so the UI can tease "something's there" without spoiling it.
export interface AchievementDisplay {
  title: string;
  description: string;
  icon: string;
  masked: boolean;
}

export function achievementDisplay(a: Achievement): AchievementDisplay {
  if (a.hidden && !a.unlocked) {
    return { title: 'Secret achievement', description: 'Keep training to reveal this one', icon: 'help', masked: true };
  }
  return { title: a.title, description: a.description, icon: a.icon, masked: false };
}

export interface RarityCount {
  rarity: Rarity;
  unlocked: number;
  total: number;
}

// Per-rarity collection progress, in ascending rarity order. Surfaces how scarce
// each tier is (and how much of it the lifter owns) honestly, without needing a
// global "X% of users" backend we don't have.
export function rarityBreakdown(achievements: Achievement[]): RarityCount[] {
  return RARITY_ORDER.map(rarity => {
    const inTier = achievements.filter(a => a.rarity === rarity);
    return { rarity, unlocked: inTier.filter(a => a.unlocked).length, total: inTier.length };
  });
}

export function summarizeAchievements(achievements: Achievement[]): AchievementSummary {
  const locked = achievements.filter(a => !a.unlocked);
  // Don't tease secret badges as the "next goal".
  const nextUp = locked
    .filter(a => !a.hidden)
    .sort((a, b) => b.progress - a.progress)[0] ?? null;
  return {
    unlockedCount: achievements.filter(a => a.unlocked).length,
    total: achievements.length,
    nextUp,
  };
}
