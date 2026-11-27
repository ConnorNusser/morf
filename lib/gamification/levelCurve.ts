// Account level curve: total XP → level. Pure data + math, no history access.
// Cost of going from level L to L+1 is 150 + 40·(L−1), so early levels come in
// a session or two and Level 50 takes ~1.7 years at a typical ~600 XP/week.

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

// Ordered low → high. A title holds until the next one's minLevel.
export const LEVEL_TITLES: LevelTitle[] = [
  { minLevel: 1, title: 'Rookie' },
  { minLevel: 5, title: 'Regular' },
  { minLevel: 10, title: 'Grinder' },
  { minLevel: 20, title: 'Iron' },
  { minLevel: 30, title: 'Veteran' },
  { minLevel: 50, title: 'Legend' },
];

export function levelTitle(level: number): string {
  let title = LEVEL_TITLES[0].title;
  for (const t of LEVEL_TITLES) if (level >= t.minLevel) title = t.title;
  return title;
}

// Next title milestone above `level`, or null at the top.
export function nextLevelTitle(level: number): LevelTitle | null {
  return LEVEL_TITLES.find(t => t.minLevel > level) ?? null;
}

export interface LevelProgress {
  level: number;
  title: string;
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
