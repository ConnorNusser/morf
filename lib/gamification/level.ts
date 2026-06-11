// Lifter level + XP — a single always-climbing number, the classic engagement
// hook. XP is earned from training volume, sessions, active days and unlocked
// achievements; levels follow a widening triangular curve. Pure + derived.
import { convertWeight, GeneratedWorkout } from '@/types';
import { CareerStats } from './careerStats';

export const XP_PER_WORKOUT = 60;
export const VOLUME_PER_XP = 80; // lbs of volume per 1 XP
export const XP_PER_ACTIVE_DAY = 25;
export const XP_PER_ACHIEVEMENT = 250;

// Cumulative XP required to *reach* a given level. Level 1 starts at 0; the curve
// widens gently (LEVEL_CURVE * L * (L-1)) so early levels come fast and later
// ones stay meaningful — an active lifter lands in the 20s, not stuck at ~10.
const LEVEL_CURVE = 100;

function cumulativeXpForLevel(level: number): number {
  return LEVEL_CURVE * level * (level - 1);
}

export function totalXp(stats: CareerStats, unlockedAchievements: number): number {
  const volumeLbs = stats.unit === 'kg' ? convertWeight(stats.totalVolume, 'kg', 'lbs') : stats.totalVolume;
  return Math.round(
    stats.totalWorkouts * XP_PER_WORKOUT +
      volumeLbs / VOLUME_PER_XP +
      stats.daysActive * XP_PER_ACTIVE_DAY +
      unlockedAchievements * XP_PER_ACHIEVEMENT,
  );
}

// XP a single session contributes: the per-workout bonus plus its volume. The
// active-day and achievement bonuses aren't attributable to one session, so this
// is a session's core earned XP — used to annotate the history log.
export function workoutXp(volumeLbs: number): number {
  return Math.round(XP_PER_WORKOUT + Math.max(0, volumeLbs) / VOLUME_PER_XP);
}

function startOfWeekMonday(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
}

export interface WeeklyMomentum {
  xp: number; // XP earned from this week's sessions
  sessions: number; // workouts logged this week
}

// Reward-for-showing-up signal: XP + sessions earned this calendar week. Always
// climbs from effort alone — independent of whether the lifter got stronger.
export function weeklyMomentum(workouts: GeneratedWorkout[], now: Date = new Date()): WeeklyMomentum {
  const start = startOfWeekMonday(now);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  let xp = 0;
  let sessions = 0;
  for (const w of workouts) {
    const created = new Date(w.createdAt);
    if (created < start || created >= end) continue;
    sessions += 1;
    let volumeLbs = 0;
    for (const ex of w.exercises || []) {
      for (const set of ex.completedSets || []) {
        if (!set.completed) continue;
        volumeLbs += (set.unit === 'lbs' ? set.weight : convertWeight(set.weight, set.unit, 'lbs')) * set.reps;
      }
    }
    xp += workoutXp(volumeLbs);
  }
  return { xp, sessions };
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
  // Largest level L with cumulativeXpForLevel(L) <= xp (inverse of the curve).
  const level = Math.max(
    1,
    Math.floor((LEVEL_CURVE + Math.sqrt(LEVEL_CURVE * LEVEL_CURVE + 4 * LEVEL_CURVE * xp)) / (2 * LEVEL_CURVE)),
  );
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
