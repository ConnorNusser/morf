// Account level curve: total XP → level. Pure data + math, no history access.
// Cost of going from level L to L+1 is 150 + 40·(L−1), so early levels come in
// a session or two and Level 50 takes ~1.7 years at a typical ~600 XP/week.
import { nextRank, rankForLevel } from './ranks';

export const LEVEL_BASE_COST = 150;
export const LEVEL_COST_STEP = 40;

// XP needed to go from `level` to `level + 1`.
export function xpForNextLevel(level: number): number {
  return LEVEL_BASE_COST + LEVEL_COST_STEP * (Math.max(1, level) - 1);
}

// Total XP at which `level` is reached (Level 1 = 0 XP).
export function totalXpForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level)) - 1; // levels already completed
  return LEVEL_BASE_COST * n + (LEVEL_COST_STEP * n * (n - 1)) / 2;
}

export interface LevelTitle {
  minLevel: number;
  title: string;
}

// Titles are anime-style ranks (lib/gamification/ranks.ts): one every 5 levels.
// These two stay as aliases so callers that only want copy needn't know ranks.
export function levelTitle(level: number): string {
  return rankForLevel(level).name;
}

// Next rank above `level`, or null at the top.
export function nextLevelTitle(level: number): LevelTitle | null {
  const next = nextRank(level);
  return next ? { minLevel: next.minLevel, title: next.name } : null;
}

export interface LevelProgress {
  level: number;
  title: string; // rank name, e.g. "Elite"
  totalXp: number;
  xpIntoLevel: number; // XP earned since reaching `level`
  xpForNext: number; // XP span of the current level
  xpToNext: number; // XP still needed for level + 1
  progress: number; // 0..1 through the current level
}

export function levelForXp(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp));
  // Invert the quadratic for a starting guess, then settle exactly (float-safe).
  const a = LEVEL_COST_STEP / 2;
  const b = LEVEL_BASE_COST - LEVEL_COST_STEP / 2;
  let n = Math.max(0, Math.floor((-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a)));
  while (totalXpForLevel(n + 2) <= xp) n++;
  while (n > 0 && totalXpForLevel(n + 1) > xp) n--;

  const level = n + 1;
  const floor = totalXpForLevel(level);
  const span = xpForNextLevel(level);
  const into = xp - floor;
  return {
    level,
    title: levelTitle(level),
    totalXp: xp,
    xpIntoLevel: into,
    xpForNext: span,
    xpToNext: span - into,
    progress: into / span,
  };
}
