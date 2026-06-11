// Lifter level + XP — a single always-climbing number, the classic engagement
// hook. XP is earned from training volume, sessions, active days and unlocked
// achievements; levels follow a widening triangular curve. Pure + derived.
import { convertWeight } from '@/types';
import { CareerStats } from './careerStats';

export const XP_PER_WORKOUT = 50;
export const XP_PER_100_LBS = 1; // 1 XP per 100 lbs of volume
export const XP_PER_ACTIVE_DAY = 20;
export const XP_PER_ACHIEVEMENT = 200;

// Cumulative XP required to *reach* a given level. Level 1 starts at 0; each
// level costs 250 more than the last (triangular: 250 * L * (L-1)).
function cumulativeXpForLevel(level: number): number {
  return 250 * level * (level - 1);
}

export function totalXp(stats: CareerStats, unlockedAchievements: number): number {
  const volumeLbs = stats.unit === 'kg' ? convertWeight(stats.totalVolume, 'kg', 'lbs') : stats.totalVolume;
  return Math.round(
    stats.totalWorkouts * XP_PER_WORKOUT +
      (volumeLbs / 100) * XP_PER_100_LBS +
      stats.daysActive * XP_PER_ACTIVE_DAY +
      unlockedAchievements * XP_PER_ACHIEVEMENT,
  );
}

export interface LevelInfo {
  level: number;
  xp: number;
  xpIntoLevel: number; // XP earned past the current level's floor
  xpForNextLevel: number; // XP span of the current level
  progress: number; // 0..1 toward next level
  title: string;
}

// Flavor title for a level band — keeps the climb feeling meaningful.
function levelTitle(level: number): string {
  if (level >= 50) return 'Mythic';
  if (level >= 40) return 'Titan';
  if (level >= 30) return 'Veteran';
  if (level >= 20) return 'Seasoned';
  if (level >= 12) return 'Dedicated';
  if (level >= 6) return 'Rising';
  if (level >= 2) return 'Novice';
  return 'Rookie';
}

export function computeLevel(stats: CareerStats, unlockedAchievements: number): LevelInfo {
  const xp = totalXp(stats, unlockedAchievements);
  // Largest level L with cumulativeXpForLevel(L) <= xp (inverse of triangular).
  const level = Math.max(1, Math.floor((250 + Math.sqrt(62500 + 1000 * xp)) / 500));
  const floor = cumulativeXpForLevel(level);
  const next = cumulativeXpForLevel(level + 1);
  const xpForNextLevel = next - floor;
  const xpIntoLevel = xp - floor;
  return {
    level,
    xp,
    xpIntoLevel,
    xpForNextLevel,
    progress: xpForNextLevel > 0 ? Math.max(0, Math.min(1, xpIntoLevel / xpForNextLevel)) : 0,
    title: levelTitle(level),
  };
}
